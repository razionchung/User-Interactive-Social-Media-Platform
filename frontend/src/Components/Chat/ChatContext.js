import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import config from '../../config.json';
import { getCookie } from '../../utils';
import axios from 'axios';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const currentUser = getCookie('username');

  const [chats, setChats] = useState([]);
  useEffect(() => {
    const getChatGroups = async () => {
      try {
        const rootURL = config.serverRootURL;
        const response = await axios.get(`${rootURL}/chatGroups?username=${currentUser}`, {
          withCredentials: true
        });
        const chatGroups = response.data.results
        console.log(chatGroups)
        setChats(chatGroups);
      } catch (error) {
        console.error("Error fetching chat:", error);
      }
    };

    getChatGroups();
  }, []);

  const [currentChat, setCurrentChat] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const socket = io(config.serverRootURL);
  socket.emit('setup', { username: currentUser });

  useEffect(() => {
    if (!currentChat) return;
    socket.emit('join user specific room', { chat_id: currentChat.chat_id });
  }, [currentChat])

  const leaveChat = async (chatId) => {
    setChats(prev => prev.filter(chat => chat.chat_id !== chatId));
    if (currentChat && currentChat.chat_id === chatId) {
      setCurrentChat(null);  // Clear the current chat if it's the one being left
    }
    socket.emit('leave-chat', { chatId: chatId, username: currentUser });

    try {
      const response = await axios.post(`${config.serverRootURL}/leaveChatGroup`, {
        chat_id: currentChat.chat_id,
        username: currentUser
      }, {
        withCredentials: true
      });
      console.log(response.data.message);
    } catch (error) {
      console.error('Failed to leave chat:', error);
    }

  };


  return (
    <ChatContext.Provider value={{ chats, currentChat, setCurrentChat, invitations, socket, leaveChat, currentUser }}>
      {children}
    </ChatContext.Provider>
  );
};
