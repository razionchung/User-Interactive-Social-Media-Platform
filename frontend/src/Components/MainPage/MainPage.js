import React from 'react';
import './MainPage.css';
import Sidebar from '../SideBar/Sidebar';
import Feed from '../Feed/Feed';
import FriendRecommendations from '../FriendRecommendations/Recommendations';
import FriendsList from '../FriendsList/FriendsList';
import FollowedBy from '../FriendRecommendations/FollowedBy';

const MainPage = () => {
    return (
        <div className="main-page">
            <Sidebar className="sidebar" />
            <Feed className="feed" />
            <div className="friend-lists">
                <FriendsList />
                <FriendRecommendations />
                <FollowedBy />
            </div>
        </div>
    );
};

export default MainPage;