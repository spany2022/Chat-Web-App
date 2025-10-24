import { Children, createContext, useContext } from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";
import { useEffect } from "react";
import { useState } from "react";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]); // store seletcted user messages
  const [users, setUsers] = useState([]); // store left side bar users
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({}); // it store key is sender id and value is how many messages are unseen

  const { socket, axios } = useContext(AuthContext);

  //Function to get all users for sidebar
  const getUsers = async () => {
    try {
      const token = localStorage.getItem("token"); // or however you store it
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`; // correct header
      const { data } = await axios.get("api/messages/users");
      if (data.success) {
        setUsers(data.users);
        setUnseenMessages(data.unseenMessages);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  //Function to get messages for selected user
  const getMessages = async (userId) => {
    try {
      const { data } = await axios.get(`/api/messages/${userId}`);
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  //Function to send message to selected user
  const sendMessage = async (messageData) => {
    try {
      const { data } = await axios.post(
        `/api/messages/send/${selectedUser._id}`,
        messageData
      );
      if (data.success) {
        setMessages((prevMessages) => [...prevMessages, data.newMessage]);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  //Function to subscribe to messages for selected user
  const subscribeToMessages = async () => {
    if (!socket) return;

    socket.on("newMessage", (newMessage) => {
      if (selectedUser && newMessage.senderId === selectedUser._id) {
        newMessage.seen = true;
        setMessages((prevMessages) => [...prevMessages, newMessage]);
        axios.put(`/api/messages/mark/${newMessage._id}`);
      } else {
        setUnseenMessages((prevUnseenMessages) => ({
          ...prevUnseenMessages,
          [newMessage.senderId]: prevUnseenMessages[newMessage.senderId]
            ? prevUnseenMessages[newMessage.senderId] + 1
            : 1,
        }));
      }
    });
  };

  //Function to unscribe from messages
  const unsubscribeFromMessages = () => {
    if (socket) socket.off("newMessage");
  };

  useEffect(() => {
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [socket, selectedUser]);

  const value = {
    messages,
    users,
    selectedUser,
    getUsers,
    getMessages,
    setMessages,
    sendMessage,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
