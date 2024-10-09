import React from 'react';
import { useChat } from './ChatContext';

const ChatMessage = ({ message, username }) => {
    const { currentUser } = useChat();
    return (
        <div className={`message ${username == currentUser ? 'mine' : ''}`}>
            {message}
        </div>
    );
};

export default ChatMessage;
