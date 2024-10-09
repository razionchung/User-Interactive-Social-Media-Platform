import React, { useState, useEffect, useContext } from 'react';
import Sidebar from '../SideBar/Sidebar';
import '../FriendsList/FriendsList.css';
import axios from 'axios';
import config from '../../config.json';
import { getCookie } from '../../utils';
// import { SocketContext } from '../../socketContext';

const FriendRecommendations = () => {
    const username = getCookie('username');
    const [recommendations, setRecommendations] = useState([]); 
    const rootURL = config.serverRootURL;

    useEffect(() => {
        fetchFriendRecommendations();
    }, [username]);

    const fetchFriendRecommendations = async () => {
        try {
            const response = await axios.get(`${rootURL}/${username}/getFriendRecs`, {
                withCredentials: true
            });
            setRecommendations(response.data.results);
        } catch (error) {
            console.error('Failed to fetch friend recommendations:', error);
        }
    };

    const handleAddFriend = async (friendUsername) => {
        try {
            await axios.post(`${rootURL}/${username}/addFriend`, {
                friend_username: friendUsername,
                withCredentials: true
            });
            fetchFriendRecommendations();
        } catch (error) {
            console.error('Failed to add friend:', error);
        }
    };

    return (
        <div className="friends-container">
            <Sidebar />
            <h2 className="friends-list-header">Friend Recommendations</h2>
            <ul className="friends-list">
                {recommendations.map(friend => (
                    <li key={friend.username} className="friend">
                        <img src={friend.profile_pic_url} alt={friend.fullname} className="friend-profile-pic" />
                        <div className="friend-info">
                            <div className="friend-name">{friend.fullname}</div>
                            <div className="friend-strength">
                                {friend.strength === 0 ? "Top Influencer" : `Mutual Friends: ${friend.strength}`}
                            </div>
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

export default FriendRecommendations;
