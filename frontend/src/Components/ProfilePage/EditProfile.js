import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../SideBar/Sidebar';
import axios from 'axios';
import config from '../../config.json';
import { getCookie } from '../../utils';
import "./EditProfile.css";

const EditProfile = () => {
    const username = getCookie('username');
    const navigate = useNavigate();
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [selectedActor, setSelectedActor] = useState('');
    const [actors, setActors] = useState([]);
    const [selectedHashtags, setSelectedHashtags] = useState([]);
    const [hashtags, setHashtags] = useState([]);
    const [statusMessage, setStatusMessage] = useState('');

    const rootURL = config.serverRootURL;

    useEffect(() => {
        const fetchActors = async () => {
            try {
                const response = await axios.get(`${rootURL}/${username}/get_matched_actors`);
                if (response.status === 200) {
                    const actorImages = response.data.images.map((actor) => ({
                        actor_nconst: actor.actor_nconst,
                        image_url: actor.image_url,
                    }));
                    setActors(actorImages);
                    setSelectedHashtags(response.data.current_hashtags);
                    setHashtags([...response.data.current_hashtags, ...response.data.hashtags_rec]);
                }
            } catch (error) {
                console.error('Failed to fetch actors:', error);
                setStatusMessage('Failed to load actor images');
            }
        };

        fetchActors();
    }, [username]);

    const handleHashtagToggle = (hashtag) => {
        setSelectedHashtags(prev =>
            prev.includes(hashtag) ? prev.filter(h => h !== hashtag) : [...prev, hashtag]
        );
    };

    const handleActorSelect = (actor) => {
        setSelectedActor(actor.actor_nconst);
        setStatusMessage(`${username} is now linked to ${actor.actor_nconst}`);
        setTimeout(() => setStatusMessage(''), 3000); // Clear message after 3 seconds
    };

    const handleSaveChanges = async () => {
        const payload = {
            email: newEmail,
            newPassword: newPassword,
            actor_nconst: selectedActor,
            newHashtags: selectedHashtags,
        };

        console.log('Payload:', payload);

        try {
            const response = await axios.post(`${rootURL}/${username}/updateProfile`, payload);
            if (response.status === 200) {
                setStatusMessage('Profile updated successfully.');
                navigate(`/${username}/profile`);
            } else {
                throw new Error('Failed to update profile');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            setStatusMessage(error.response ? error.response.data.error : 'Failed to update profile');
        }
    };

    return (
        <div className="edit-profile-layout">
            <aside className="edit-profile-sidebar">
                <Sidebar />
            </aside>
            <div className="edit-profile-main">
                <h1>Edit Profile for {username}</h1>
                {statusMessage && <div className="status-message">{statusMessage}</div>}
                <div className="edit-profile-form">
                    <label>New Email:</label>
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                    <label>New Password:</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="actor-selection">
                    <h2>Select Your Actor</h2>
                    <div className="actor-grid">
                        {actors.map((actor, index) => (
                            <div key={index} className="actor" onClick={() => handleActorSelect(actor)}>
                                <img src={actor.image_url} alt={actor.actor_nconst} />
                                <p>{actor.actor_nconst}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="hashtags">
                    {hashtags.map((hashtag, index) => (
                        <button key={index} type="button" onClick={() => handleHashtagToggle(hashtag)}
                            className={`hashtag ${selectedHashtags.includes(hashtag) ? 'selected' : ''}`}>
                            {hashtag}
                        </button>
                    ))}
                </div>
                <button onClick={handleSaveChanges} className="save-changes-btn">Save Changes</button>
            </div>
        </div>
    );
};

export default EditProfile;
