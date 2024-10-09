import React, { useEffect, useState } from 'react';
import { useChat } from './ChatContext';
import ChatMessage from './ChatMessage';
import axios from 'axios';
import config from '../../config.json';

const ChatWindow = () => {
  const { currentChat, leaveChat, currentUser, icon_img_url, socket } = useChat();

  const [chatProfileImage, setChatProfileImage] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatParticipants, setChatParticipants] = useState([]);

  const [message, setMessage] = useState('');

  const [selectedFile, setSelectedFile] = useState(null);

  const sendMessage = () => {
    if (currentChat) {
      const rootURL = config.serverRootURL;
      const chat_id = currentChat.chat_id;
      const payload = {
        username: currentUser,
        chat_id: chat_id,
        message: message
      };
      axios.post(`${rootURL}/chatMessage`, payload, {
        withCredentials: true
      })
        .then(response => {
          if (response.status === 201) {
            setMessage('');
            socket.emit('new message', { chat_id: chat_id });
            getMessages();
          } else {
            console.log(response)
            throw new Error('Failed to send message');
          }
        })
        .catch(error => {
          console.error('Error sending message:', error);
        });
    }
  };

  const handleFileSelect = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const uploadProfilePic = () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('chat_id', currentChat.chat_id);
    formData.append('file', selectedFile);

    axios.post(`${config.serverRootURL}/uploadChatProfile`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    })
      .then(response => {
        console.log('Upload successful:', response.data);
      })
      .catch(error => {
        console.error('Error uploading image:', error);
      });
  };

  const getMessages = async () => {
    try {
      const rootURL = config.serverRootURL;
      const response = await axios.get(`${rootURL}/chatMessages?chat_id=${currentChat.chat_id}`, {
        withCredentials: true
      });
      const messages = response.data.results;
      setMessages(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  useEffect(() => {
    const getChatParticipants = async () => {
      try {
        const rootURL = config.serverRootURL;
        const response = await axios.get(`${rootURL}/chatParticipants?chat_id=${currentChat.chat_id}`, {
          withCredentials: true
        });
        const participants = response.data.results;
        console.log(participants)
        setChatParticipants(participants);
      } catch (error) {
        console.error("Error fetching chat participants:", error);
      }
    };

    const setupSocketCallbackToRecieveNewMessages = () => {
      socket.on('new message', (data) => {
        if (currentChat.chat_id != data.chat_id) return;
        getMessages();
      });
    };

    const setupSocketCallbackForLeave = () => {
      socket.on('user left', (data) => {
        if (data.chatId === currentChat.chat_id) {
          console.log(`${data.username} left the chat.`);
          // Filter out the user who left from the participants list
          setChatParticipants(prevParticipants => 
            prevParticipants.filter(user => user.username !== data.username)
          );
        }
      });
    }
    if (!currentChat) return;
    getChatParticipants();
    setupSocketCallbackForLeave();
    setupSocketCallbackToRecieveNewMessages();
  }, [currentChat]);

  useEffect(() => {
    if (!currentChat) return;
    getMessages();
  }, [currentChat])

  return (
    <div className="chat-window">
      {currentChat ? (
        <>
          <div className="chat-header">
            <img src={currentChat.icon_img_url || '/default_chat_icon.png'} alt={`${currentChat.name}`} className="chat-profile-img" />
            <input type="file" onChange={handleFileSelect} />
            <button onClick={uploadProfilePic}>Upload Chat Icon</button>
            <div className="chat-info">
              <h3>{currentChat.name}</h3>
              <p>Last seen: {currentChat.lastSeen}</p>
            </div>
            {chatParticipants && chatParticipants.map(user => (
              <img key={user.id} src={user.profile_pic_url != "undefined" ? user.profile_pic_url : '/default_avatar.png'} alt={user.name} className="chat-profile-img" />
            ))}
            <button onClick={() => leaveChat(currentChat.chat_id)}>Leave Chat</button>
          </div>
          <div className="messages">
            {messages && messages.map(msg => <ChatMessage key={msg.message} message={msg.message} username={msg.username} />)}

          </div>
        </>
      ) : <div className="no-chat-selected">Select a chat to view messages</div>}
      <div className="input-area">
        <input className="input-field" value={message} onChange={e => setMessage(e.target.value)} placeholder="Type a message..." />
        <button className="send-button" onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};

export default ChatWindow;
