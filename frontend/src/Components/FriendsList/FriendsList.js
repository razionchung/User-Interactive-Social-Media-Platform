import React, { useState, useEffect, useContext } from 'react';
import Sidebar from '../SideBar/Sidebar';
import './FriendsList.css';
import '../SideBar/Sidebar.css';
import axios from 'axios';
import config from '../../config.json';
import { getCookie } from '../../utils';
import { SocketContext } from '../../socketContext';

const FriendsList = () => {
    const username = getCookie('username');
    const [friends, setFriends] = useState([]);
    const [friendStatus, setFriendStatus] = useState({}); // display add/remove button based on this
    const socket = useContext(SocketContext);

    const rootURL = config.serverRootURL;

    useEffect(() => {
        fetchFriends();
    }, [username]);

    useEffect(() => {
        console.log('Friends:', friends);
        const status = {};
        friends.forEach(friend => {
            status[friend.username] = true; 
        });
        setFriendStatus(status);
        console.log('Friend status:', status);
    }, [friends]);

    useEffect(() => {
        console.log('Socket on mount:', socket);
        if (!socket) {
            console.log('Socket not available');
            return;
        }
        console.log('Socket available');
        socket.on('user online', (data) => {
            console.log(`Received 'user online' for ${data.username}`);
            setFriends(prevFriends => prevFriends.map(friend => 
                friend.username === data.username ? { ...friend, isOnline: true } : friend
            ));
        });
    
        socket.on('user offline', (data) => {
            console.log(`Received 'user offline' for ${data.username}`);
            setFriends(prevFriends => prevFriends.map(friend =>
                friend.username === data.username ? { ...friend, isOnline: false } : friend
            ));
        });
    
        return () => {
            if (socket) {
                socket.off('user online');
                socket.off('user offline');
            }
        };
    }, [socket]);    

    const fetchFriends = async () => {
        try {
            const response = await axios.get(`${rootURL}/${username}/friends`, {
                withCredentials: true
            });
            const loadedFriends = response.data.results.map(friend => ({
                username: friend.username,
                fullname: friend.fullname,
                isOnline: false, // default offline until socket updates
                profilePicture: friend.profile_pic_url
            }));
            console.log('Loaded friends:', loadedFriends);
            setFriends(loadedFriends);
        } catch (error) {
            console.error('Failed to fetch friends:', error);
        }
    };

    const toggleFriendStatus = async (friendUsername) => {
        const currentStatus = friendStatus[friendUsername];
        console.log('Current status:', currentStatus);

        if (currentStatus) {
            // remove friend
            try {
                await axios.post(`${rootURL}/${username}/removeFriend`, { 
                    friend_username: friendUsername,
                    withCredentials: true
                });
                setFriendStatus(prev => ({ ...prev, [friendUsername]: false }));
            } catch (error) {
                console.error('Failed to remove friend:', error);
            }
        } else {
            // add friend
            try {
                await axios.post(`${rootURL}/${username}/addFriend`, { 
                    friend_username: friendUsername,
                    withCredentials: true
                });
                setFriendStatus(prev => ({ ...prev, [friendUsername]: true }));
            } catch (error) {
                console.error('Failed to add friend:', error);
            }
        }
    };

    return (
        <div className="friends-container">
            <Sidebar className="sidebar"/>
            <h2 className="friends-list-header">My Friends</h2>
            <ul className="friends-list">
                {friends.map(friend => (
                    <li key={friend.username} className="friend">
                        <img src={friend.profilePicture} alt={friend.fullname} className="friend-profile-pic" />
                        <div className="friend-info">
                            <div className="friend-name">{friend.fullname}</div>
                            <div className={`friend-status ${friend.isOnline ? 'online' : 'offline'}`}>
                                {friend.isOnline ? 'Online' : 'Offline'}
                            </div>
                            <button onClick={() => toggleFriendStatus(friend.username)}>
                                {friendStatus[friend.username] ? 'Unfollow' : 'Follow'}
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default FriendsList;