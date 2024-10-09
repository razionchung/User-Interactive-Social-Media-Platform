import React, { useState, useEffect, useContext } from 'react';
import Sidebar from '../SideBar/Sidebar';
import '../FriendsList/FriendsList.css';
import axios from 'axios';
import config from '../../config.json';
import { getCookie } from '../../utils';
// import { SocketContext } from '../../socketContext';

const FollowedBy = () => {
    const username = getCookie('username');
    const [followedBy, setFollowedBy] = useState([]); 
    const rootURL = config.serverRootURL;

    useEffect(() => {
        fetchFollowedBy();
    }, [username]);

    const fetchFollowedBy = async () => {
        try {
            const response = await axios.get(`${rootURL}/${username}/getFollowedBy`, {
                withCredentials: true
            });
            setFollowedBy(response.data.results);
        } catch (error) {
            console.error('Failed to fetch my follower:', error);
        }
    };

    const handleAddFriend = async (friendUsername) => {
        try {
            await axios.post(`${rootURL}/${username}/addFriend`, {
                friend_username: friendUsername,
                withCredentials: true
            });
            fetchFollowedBy();
        } catch (error) {
            console.error('Failed to add friend:', error);
        }
    };

    return (
        <div className="friends-container">
            <Sidebar />
            <h2 className="friends-list-header">Friend Requests</h2>
            <ul className="friends-list">
                {followedBy.map(friend => (
                    <li key={friend.username} className="friend">
                        <img src={friend.profile_pic_url} alt={friend.fullname} className="friend-profile-pic" />
                        <div className="friend-info">
                            <div className="friend-name">{friend.fullname}</div>
                            <button onClick={() => handleAddFriend(friend.username)}>
                                Follow
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default FollowedBy;
