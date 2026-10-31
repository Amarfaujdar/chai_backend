import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Video } from "../models/video.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";

// Get all videos with pagination, search, sort
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query = "", sortBy = "createdAt", sortType = "desc", userId } = req.query;

    const matchStage = {
        isPublished: true,
        ...(query && { title: { $regex: query, $options: "i" } }),
        ...(userId && mongoose.isValidObjectId(userId) && { owner: new mongoose.Types.ObjectId(userId) })
    };

    const sortStage = { [sortBy]: sortType === "asc" ? 1 : -1 };

    const videos = await Video.aggregatePaginate(
        Video.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner",
                    pipeline: [{ $project: { username: 1, fullName: 1, avatar: 1 } }]
                }
            },
            { $addFields: { owner: { $arrayElemAt: ["$owner", 0] } } },
            { $sort: sortStage }
        ]),
        { page: parseInt(page), limit: parseInt(limit) }
    );

    return res.status(200).json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

// Publish a video
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required");
    }

    const videoLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoLocalPath) throw new ApiError(400, "Video file is required");
    if (!thumbnailLocalPath) throw new ApiError(400, "Thumbnail is required");

    const videoFile = await uploadOnCloudinary(videoLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFile) throw new ApiError(500, "Video upload failed");
    if (!thumbnail) throw new ApiError(500, "Thumbnail upload failed");

    const video = await Video.create({
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        title,
        description,
        duration: videoFile.duration,
        owner: req.user._id
    });

    return res.status(201).json(new ApiResponse(201, video, "Video published successfully"));
});

// Get a video by ID
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }
    const video = await Video.findById(videoId).populate("owner", "username fullName avatar");
    if (!video) throw new ApiError(404, "Video not found");

    // Increment views
    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });

    return res.status(200).json(new ApiResponse(200, video, "Video fetched successfully"));
});

// Update video details
const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video not found");
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this video");
    }

    if (title) video.title = title;
    if (description) video.description = description;

    if (req.file?.path) {
        const thumbnail = await uploadOnCloudinary(req.file.path);
        if (!thumbnail) throw new ApiError(500, "Thumbnail upload failed");
        video.thumbnail = thumbnail.url;
    }

    await video.save();
    return res.status(200).json(new ApiResponse(200, video, "Video updated successfully"));
});

// Delete video
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }
    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video not found");
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video");
    }
    await Video.findByIdAndDelete(videoId);
    return res.status(200).json(new ApiResponse(200, {}, "Video deleted successfully"));
});

// Toggle publish status
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }
    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video not found");
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this video");
    }
    video.isPublished = !video.isPublished;
    await video.save();
    return res.status(200).json(new ApiResponse(200, { isPublished: video.isPublished }, "Publish status toggled"));
});

export { getAllVideos, publishAVideo, getVideoById, updateVideo, deleteVideo, togglePublishStatus };

