import React, { useState } from 'react';
import './Search.css';
import Sidebar from '../SideBar/Sidebar';
import axios from 'axios';
import config from '../../config.json';

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' or 'users'
  const [isLoading, setIsLoading] = useState(false);

  const [relatedPosts, setRelatedPosts] = useState(null)
  const [relatedUsers, setRelatedUsers] = useState(null)

  const handleSearchInputChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const sendSearchQuery = async (event) => {
    if (activeTab === 'posts') {
      event.preventDefault();
      const rootURL = config.serverRootURL;
      const urlEncodedQueryString = encodeURIComponent(searchQuery);
      setIsLoading(true);
      const response = await axios.get(`${rootURL}/relatedPosts?queryString=${urlEncodedQueryString}`, {
        withCredentials: true
      });
      setIsLoading(false);
      console.log(response.data)
      setRelatedPosts(response.data)
    } else {
      event.preventDefault();
      const rootURL = config.serverRootURL;
      const urlEncodedQueryString = encodeURIComponent(searchQuery);
      setIsLoading(true);
      const response = await axios.get(`${rootURL}/relatedProfiles?queryString=${urlEncodedQueryString}`, {
        withCredentials: true
      });
      setIsLoading(false);
      console.log(response.data)
      setRelatedUsers(response.data)
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="search-page">
      <Sidebar />
      <div className="search-content">
        <form onSubmit={sendSearchQuery}>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchInputChange}
            placeholder={`Search ${activeTab}`}
            className="search-input"
          />
        </form>
        <div className="search-tabs">
          <button
            onClick={() => handleTabChange('posts')}
            className={`tab ${activeTab === 'posts' ? 'active' : ''}`}
          >
            Posts
          </button>
          <button
            onClick={() => handleTabChange('users')}
            className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          >
            Users
          </button>
        </div>
        {isLoading && <div>Loading...</div>}
        {activeTab === 'posts' ? (
          <div>
            {relatedPosts && relatedPosts.map(post => (
              <div key={post.post_id}>{post.content}</div>
            ))}
          </div>
        ) : (
          <div>
            {relatedUsers && relatedUsers.map(user => (
              <div key={user.username}>{user.username}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
