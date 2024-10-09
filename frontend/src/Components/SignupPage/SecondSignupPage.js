import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; 
import axios from 'axios';
import config from '../../config.json';
import './SecondSignupPage.css';
import Cookies from 'js-cookie';

export default function SecondSignupForm(){
    const [hashtags, setHashtags] = useState([]);
    const [actors, setActors] = useState([]);
    const [selectedHashtags, setSelectedHashtags] = useState([]);
    const [selectedActors, setSelectedActors] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const username = searchParams.get('username');
        const profile_pic = searchParams.get('profile_pic');

        if (!username || !profile_pic) {
            console.error("Username and profile picture are required");
            return;
        }

        const fetchActors = async () => {
            setIsLoading(true);
            const rootURL = config.serverRootURL;
            try {
                const response = await axios.get(`${rootURL}/faceMatching`, {
                    params: {
                        username: username,
                        profile_pic: profile_pic
                    }
                });
                if (response.status === 200 && response.data) {
                    const hashtagData = response.data.find(item => item.hashtags);
                    const actorData = response.data.filter(item => item.actor_id);
                    if (hashtagData) {
                        setHashtags(hashtagData.hashtags);
                    }
                    if (actorData) {
                        setActors(actorData);
                    }
                } else {
                    throw new Error('Failed to fetch actors and hashtags');
                }
            } catch (error) {
                console.error('Error fetching actors:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchActors();
    }, [location.search]);

    const handleHashtagToggle = (hashtag) => {
        setSelectedHashtags(prev =>
            prev.includes(hashtag) ? prev.filter(h => h !== hashtag) : [...prev, hashtag]
        );
    };

    const handleActorSelect = (actorId) => {
        setSelectedActors([actorId]);
    };

    const handlePrevious = () => {
        navigate('/register'); // Navigate to the signup page
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const searchParams = new URLSearchParams(location.search);
        const username = searchParams.get('username');

        try {
            const actor_nconst = selectedActors[0];
            const rootURL = config.serverRootURL;
            const response = await axios.post(`${rootURL}/faceMatching`, {
                username,
                actor_nconst,
                selectedHashtags
            });
    
            if (response.status === 200) {
                Cookies.set('username', username);
                navigate(`/${username}/main`); 
            } else {
                throw new Error('Failed to update preferences');
            }
        } catch (error) {
            alert("Failed to update preferences. " + error.message);
            console.error('Error submitting preferences:', error);
        }
    };

    return (
        <div className="second-signup-form-container">
            <h1>Select Your Interests and Favorite Actors</h1>
            {isLoading ? (
                <div>Loading actors...</div>
            ) : (
                <form onSubmit={handleSubmit}>
                    <div className="hashtags">
                        {hashtags.map((hashtag, index) => (
                            <button key={index} type="button" onClick={() => handleHashtagToggle(hashtag)}
                                className={`hashtag ${selectedHashtags.includes(hashtag) ? 'selected' : ''}`}>
                                {hashtag}
                            </button>
                        ))}
                    </div>
                    <div className="actors">
                        {actors.map((actor, index) => (
                            <div key={index} className={`actor ${selectedActors.includes(actor.actor_id) ? 'selected' : ''}`} onClick={() => handleActorSelect(actor.actor_id)}>
                                <img src={actor.image_url} alt={actor.actor_id} />
                                <p>Percentage of Similarity: {actor.distance * 100} %</p>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handlePrevious} className="previous-btn">Disregard registration</button>
                    <button type="submit" className="signup-btn">Sign up</button>
                </form>
            )}
        </div>
    );
};
