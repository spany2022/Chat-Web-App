import Message from "../models/Message.js";
import User from "../models/User.js";
import cloudinary from "../lib/cloudinary.js";
import {io, userSocketMap} from "../server.js"

//Get all users except the logged in user
export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;
    // userId = "2"  Bob

    const filteredUsers = await User.find({ _id: { $ne: userId } }).select(
      "-password"
    );
    //     filteredUsers = [
    //   { _id: "1", name: "Alice" },
    //   { _id: "3", name: "Carol" }
    // ]

    //count number of messages not seen
    const unseenMessages = {};
    const promises = filteredUsers.map(async (user) => {
      const messages = await Message.find({
        senderId: user._id,
        receiverId: userId,
        seen: false,
      });

      //       Example Message collection:

      // senderId	receiverId	text	    seen
      // 1	           2	"Hi Bob"	false
      // 1	           2	"Are you?"	false
      // 3	           2	"Hello Bob"	true

      // Alice (_id:1) → 2 unseen messages

      // Carol (_id:3) → 0 unseen messages

      if (messages.length > 0) {
        unseenMessages[user._id] = messages.length;
      }
    });
    // unseenMessages = {
    //   "1": 2,
    // };

    await Promise.all(promises);
    res.json({ success: true, users: filteredUsers, unseenMessages });

    //     {
    //   "success": true,
    //   "users": [
    //     { "_id": "1", "name": "Alice" },
    //     { "_id": "3", "name": "Carol" }
    //   ],
    //   "unseenMessages": {
    //     "1": 2
    //   }
    // }
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

//Get all messages for selected user
export const getMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: myId },
      ],
    });
    //     [
    //   { "senderId": "1", "receiverId": "2", "text": "Hi Bob", "seen": false },
    //   { "senderId": "2", "receiverId": "1", "text": "Hey Alice", "seen": true },
    //   { "senderId": "1", "receiverId": "2", "text": "How are you?", "seen": false }
    // ]

    await Message.updateMany(
      { senderId: selectedUserId, receiverId: myId },
      { seen: true }
    );

    res.json({ success: true, messages });

    //message outpot like:
    //                 {
    //   "success": true,
    //   "messages": [
    //     { "senderId": "1", "receiverId": "2", "text": "Hi Bob", "seen": true },
    //     { "senderId": "2", "receiverId": "1", "text": "Hey Alice", "seen": true },
    //     { "senderId": "1", "receiverId": "2", "text": "How are you?", "seen": true }
    //   ]
    // }
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

//API to mark message as seen using message id
export const markMessageAsSeen = async (req, res) => {
    try {
        const {id} = req.params;
        await Message.findByIdAndUpdate(id, {seen: true})
        res.json({success: true})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// send message to seletcted user
export const sendMessage = async (req, res) => {
    try {
        const {text, image} = req.body;
        const receiverId = req.params.id;
        const senderId = req.user._id;

        let imageUrl;
        if(image){
            const uploadResponse = await cloudinary.uploader.upload(image)
            imageUrl = uploadResponse.secure_url;
        }
        const newMessage = await Message.create({
            senderId, receiverId, text, image: imageUrl
        })

        // Emit the new message to the receiver's socket
        const recieverSocketId = userSocketMap[receiverId];
        if(recieverSocketId) {
          io.to(recieverSocketId).emit("newMessage", newMessage)
        }

        res.json({success: true, newMessage});

    } catch (error) {
        console.log(error.message);
    res.json({ success: false, message: error.message });
    }
}
