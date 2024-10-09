import React, { useState, useEffect } from 'react';
import './ProfilePage.css';
import Sidebar from '../SideBar/Sidebar';
import axios from 'axios';
import { useNavigate, Link, useParams } from 'react-router-dom';
import config from '../../config.json';

const UserProfile = () => {
    const { username } = useParams();
    const [userInfo, setUserInfo] = useState(null);
    const navigate = useNavigate();

    const rootURL = config.serverRootURL;

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const response = await axios.get(`${rootURL}/${username}/myProfile`, {
                    withCredentials: true
                });
                if (response.status === 200) {
                    setUserInfo(response.data);
                }
            } catch (error) {
                console.error('Failed to fetch user profile:', error);
                // navigate('/'); 
            }
        };

        fetchUserProfile();
    }, [username, navigate]);

    const goToFriends = () => {
        navigate(`${username}/friends`);
    };

    return (
        <div className="user-profile">
            <aside className="sidebar">
                <Sidebar />
            </aside>
            <main className="content">
                {userInfo ? (
                    <header className="profile-header">
                        <div className="profile-picture">
                            <img src={userInfo.profile_pic_url} alt={userInfo.username} />
                        </div>
                        <div className="profile-info">
                            <h2>{userInfo.full_name}<Link to={`/${userInfo.username}/edit`}><button className="edit-profile-btn">Edit Profile</button></Link></h2>
                            {/* <ul>
                                <li><strong>{userInfo.postCount}</strong> posts</li>
                                <ul>
                                    <li onClick={goToFriends}><strong>{userInfo.followerCount}</strong> followers</li>
                                    <li onClick={goToFriends}><strong>{userInfo.followingCount}</strong> following</li>
                                </ul>
                            </ul> */}
                            <p>Username: {userInfo.username}</p>
                            <p>Birthday: {userInfo.birthday.substring(0,10)}</p>
                            <p>Affiliation: {userInfo.affiliation}</p>
                            <p>Email: {userInfo.email}</p>
                            <p>Linked Actor: <img src={userInfo.linked_actor_url} alt={userInfo.linked_nconst} style={{ width: '50px', height: '50px', borderRadius: '50%' }} /> {userInfo.linked_nconst}</p>
                            {userInfo.hashtags && userInfo.hashtags.length > 0 ? (
                                <p>Interests: {userInfo.hashtags.join(', ')}</p>  
                            ) : (
                                <p>No interests found</p>
                            )}
                        </div>
                    </header>
                ) : <p>Please log in.</p>}
                {/* TODO: probably change it into a post picture gallery */}
                {/* <section className="photo-gallery">
                    {userPhotos.map((photo, index) => (
                        <div key={index} className="photo-item">
                            <img src={photo} alt={`Photo ${index}`} />
                        </div>
                    ))}
                </section> */}
            </main>
        </div>
    );
};

export default UserProfile;
