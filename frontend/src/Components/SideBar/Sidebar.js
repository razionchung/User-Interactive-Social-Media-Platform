import React, { useState, useEffect } from 'react';
import './Sidebar.css';
import { Link, useNavigate } from 'react-router-dom';
import config from '../../config.json';
import axios from 'axios';
import { getCookie } from '../../utils';
import Cookies from 'js-cookie';

const Sidebar = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const username = getCookie('username');
    const navigate = useNavigate();
    const rootURL = config.serverRootURL;

    useEffect(() => {
        setIsLoggedIn(!!username);
    }, [username]);

    const handleLogout = async () => {
        try {
            await axios.get(`${rootURL}/logout`, {
                withCredentials: true
            });
            Cookies.remove('username');
            setIsLoggedIn(false);
            navigate('/');
        } catch (error) {
            console.error('Failed to logout:', error);
        }
    };

    const menuItems = [
        { label: 'Home', icon: '🏠', path: `/${username}/main` },
        { label: 'Search', icon: '🔍', path: `/${username}/search` },
        { label: 'Messages', icon: '✉️', path: `/${username}/chat` },
        { label: 'Create', icon: '➕', path: `/${username}/create` },
        { label: 'Profile', icon: '👤', path: `/${username}/profile` },
    ];

    return (
        <div className="sidebar">
            <div className="sidebar-logo">
                Instagram
            </div>
            <nav className="sidebar-nav">
                {menuItems.map((item, index) => (
                    item.path ? (
                        <Link to={item.path} key={index} className="sidebar-item">
                            <span className="sidebar-icon">{item.icon}</span>
                            <span className="sidebar-label">{item.label}</span>
                        </Link>
                    ) : (
                        <div key={index} className="sidebar-item" onClick={item.action}>
                            <span className="sidebar-icon">{item.icon}</span>
                            <span className="sidebar-label">{item.label}</span>
                        </div>
                    )
                ))}
            </nav>
            <div className="sidebar-footer">
                {isLoggedIn ? (
                    <button onClick={handleLogout} className="sidebar-button">
                        Logout
                    </button>
                ) : (
                    <button onClick={() => navigate('/')} className="sidebar-button">
                        Login
                    </button>
                )}
            </div>
        </div>
    );
};

export default Sidebar;
