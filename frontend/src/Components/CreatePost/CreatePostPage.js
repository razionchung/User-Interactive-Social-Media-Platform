import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios'; // Import axios here
import './CreatePostPage.css';
import Sidebar from '../SideBar/Sidebar';
import config from '../../config.json';
import { getCookie } from '../../utils';

const CreatePostPage = () => {
    const [text, setText] = useState('');
    const [image, setImage] = useState(null);
    const [hashtags, setHashtags] = useState('');
    const username = getCookie('username');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        if (text) { // Replace 'content' with 'text'
            formData.append('content', text);
        }
        if (hashtags) {
            formData.append('hashtags', hashtags);
        }
        if (image) {
            formData.append('photo', image);
        }
        const rootURL = config.serverRootURL;
        try {
            const response = await axios.post(`${rootURL}/${username}/post`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                withCredentials: true
            });
            console.log(response.data);
            navigate(`/${username}/main`);
        } catch (error) {
            console.error('Error creating post:', error);
        }
        navigate(`/${username}/main`);
    };

    return (
        <div className="create-post-container">
            <aside>
                <Sidebar />
            </aside>
            <h1>Create a New Post</h1>
            <form onSubmit={handleSubmit} className="create-post-form">
                <div className="form-group">
                    <label htmlFor="postText">Text:</label>
                    <textarea id="postText" value={text} onChange={e => setText(e.target.value)} placeholder="New content"></textarea>
                </div>
                <div className="form-group">
                    <label htmlFor="postImage">Image:</label>
                    <input type="file" id="postImage" onChange={e => setImage(e.target.files[0])} />
                </div>
                <div className="form-group">
                    <label htmlFor="postHashtags">Hashtags:</label>
                    <input type="text" id="postHashtags" value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="Add hashtags" />
                </div>
                <button type="submit">Post</button>
            </form>
        </div>
    );
};

export default CreatePostPage;
