import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginForm from "./Components/LoginPage/LoginPage";
import SignupForm from "./Components/SignupPage/SignupPage";
import SecondSignupForm from "./Components/SignupPage/SecondSignupPage";
import Feed from "./Components/Feed/Feed";
import MainPage from "./Components/MainPage/MainPage";
import UserProfile from "./Components/ProfilePage/ProfilePage";
import SearchPage from "./Components/Search/Search";
import People from "./Components/FriendRecommendations/FollowedBy";
import FriendsList from "./Components/FriendsList/FriendsList";
import EditProfile from "./Components/ProfilePage/EditProfile";
import ChatList from "./Components/Chat/ChatList";
import ChatWindow from "./Components/Chat/ChatWindow";
import { ChatProvider } from "./Components/Chat/ChatContext";
import CreatePostPage from "./Components/CreatePost/CreatePostPage";
import LikesList from "./Components/Feed/LikeList";
import './App.css';
import axios from 'axios';
import { io } from 'socket.io-client';
import { SocketContext } from './socketContext';
import config from './config.json';
import ViewUserProfile from "./Components/ProfilePage/ViewUserProfile";
import Sidebar from "./Components/SideBar/Sidebar";

axios.defaults.withCredentials = true; // include cookies in requests

function App() {
  const [socket, setSocket] = useState(null);
  const rootURL = config.serverRootURL;

  useEffect(() => {
    const newSocket = io(rootURL, {
      withCredentials: true
    });
    console.log('Socket initialized:', newSocket);

    newSocket.on('connect_error', (error) => {
      console.error('Connection Error:', error);
    });

    setSocket(newSocket);
    return () => {
      newSocket.off('connect_error');
      newSocket.close();
    }
  }, [rootURL]);

  return (
    <ChatProvider>
      <SocketContext.Provider value={socket}>
        <BrowserRouter>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' }}>
            <Routes>
              <Route path="/" element={<LoginForm />} />
              <Route path="/register" element={<SignupForm />} />
              <Route path="/secondsignup" element={<SecondSignupForm />} />
              <Route path="/:username/feed" element={<Feed />} />
              <Route path="/:username/profile" element={<UserProfile />} />
              <Route path="/:username/main" element={<MainPage />} />
              <Route path="/:username/search" element={<SearchPage />} />
              <Route path="/:username/people" element={<People />} />
              <Route path="/:username/friends" element={<FriendsList />} />
              <Route path="/:username/edit" element={<EditProfile />} />
              <Route path="/:username/chat" element={
                <div className="chat-layout">
                  <Sidebar className="chat-sidebar" />
                  <div className="chat-main">
                    <ChatList className="chat-list" />
                    <ChatWindow className="chat-window" />
                  </div>
                </div>
              } />
              <Route path="/:username/create" element={<CreatePostPage />} />
              <Route path="/:post/likes" element={<LikesList />} />
              <Route path="/:username/test" element={<Feed />} />
              <Route path="/:username/viewProfile" element={<ViewUserProfile />} />
            </Routes>
          </div>
        </BrowserRouter>
      </SocketContext.Provider>
    </ChatProvider>
  );
}

export default App;
