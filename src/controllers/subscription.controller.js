import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Subscription } from "../models/subscription.model.js";
import mongoose from "mongoose";

// Toggle subscribe / unsubscribe to a channel
const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    if (!mongoose.isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }
    if (channelId === req.user._id.toString()) {
        throw new ApiError(400, "You cannot subscribe to yourself");
    }

    const existing = await Subscription.findOne({
        subscriber: req.user._id,
        channel: channelId
    });

    if (existing) {
        await Subscription.findByIdAndDelete(existing._id);
        return res.status(200).json(new ApiResponse(200, { subscribed: false }, "Unsubscribed successfully"));
    }

    await Subscription.create({ subscriber: req.user._id, channel: channelId });
    return res.status(200).json(new ApiResponse(200, { subscribed: true }, "Subscribed successfully"));
});

// Get list of subscribers for a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    if (!mongoose.isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }
    const subscribers = await Subscription.find({ channel: channelId })
        .populate("subscriber", "username fullName avatar");

    return res.status(200).json(new ApiResponse(200, subscribers, "Subscribers fetched successfully"));
});

// Get list of channels a user has subscribed to
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;
    if (!mongoose.isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID");
    }
    const channels = await Subscription.find({ subscriber: subscriberId })
        .populate("channel", "username fullName avatar");

    return res.status(200).json(new ApiResponse(200, channels, "Subscribed channels fetched successfully"));
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };

