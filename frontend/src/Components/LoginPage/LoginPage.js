import React, { useState } from 'react';
import './LoginPage.css';
import { useNavigate } from 'react-router-dom';
import config from '../../config.json';
import axios from 'axios';
import Cookies from 'js-cookie';

export default function LoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        const rootURL = config.serverRootURL;
        try {
            const response = await axios.post(`${rootURL}/login`, {
                username,
                password
            });

            if (response.status === 200) {
                Cookies.set('username', username);
                navigate(`/${username}/main`);
            }
        } catch (err) {
            if (err.response) {
                alert(err.response.data.error);
            } else {
                alert('Log in failed.');
            }
        }
    };

    return (
        <div className="login-page">
            <form onSubmit={handleLogin}>
                <div className="login-header">
                    <img src="loginpage_header.png" alt="Login Page" />
                </div>
                <input
                    type="text"
                    className="input-field"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <input
                    type="password"
                    className="input-field"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit" className='px-4 py-2 rounded-md bg-indigo-500 outline-none font-bold text-white'>
                    Log in
                </button>
                {/* <a href="/forgot">Forgot password?</a> */}
                <div className="login-link">
                    Don't have an account? <button onClick={() => navigate('/register')}>Sign Up</button>
                </div>
            </form>
        </div>
    );
}