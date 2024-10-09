import React, { useState, useEffect } from "react";
import { useParams } from 'react-router-dom';
import Sidebar from '../SideBar/Sidebar';
import axios from 'axios';
import config from '../../config.json';
import { getCookie } from '../../utils';
import './LikeList.css';
import { useNavigate } from 'react-router-dom';

// const initialLikes = [
//     { id: 1, name: 'Yu', profilePicture: '/sample_userphoto2.jpg' },
//     { id: 2, name: 'Botong', profilePicture: '/sample_userphoto1.jpg' },
//     { id: 3, name: 'James', profilePicture: '/sample_userphoto3.jpg' },
//     { id: 4, name: 'George', profilePicture: '/sample_userphoto4.jpg' },
// ];

const LikesList = () => {
    const [friends, setFriends] = useState([]);
    const { post } = useParams();

    const navigate = useNavigate();
    const currentUser = getCookie('username');
    const rootURL = config.serverRootURL;

    useEffect(() => {
        const fetchLikers = async () => {
            try {
                const response = await axios.get(`${rootURL}/${currentUser}/${post}/postLikers`);
                setFriends(response.data.results.map(like => ({
                    id: like.like_id,
                    name: like.liker_username,
                    profilePicture: like.profile_pic_url,
                })));
            } catch (err) {
                console.error('Failed to fetch likers:', err);
            }
        };

        fetchLikers();
    }, [currentUser, post]);


    const follow = (name) => {
        const newFriend = {
            id: friends.length + 1,
            name,
            profilePicture: '/path/to/default.jpg'
        };
        setFriends([...friends, newFriend]);
    };

    return (
        <div className="friends-container">
            <button onClick={() => navigate(-1)} className="back-button">Back</button>
            <div>Likes</div>
            <Sidebar />
            <div className="add-friend">
            </div>
            <ul className="friends-list">
                {friends.map(friend => (
                    <li key={friend.id} className="friend">
                        <img src={friend.profilePicture} alt={`${friend.name}`} className="friend-profile-pic" />
                        <div className="friend-info">
                            <div className="friend-name">{friend.name}</div>
                        </div>
                        <button onClick={() => follow(document.getElementById('friendName').value)}>
                            Follow
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default LikesList;
