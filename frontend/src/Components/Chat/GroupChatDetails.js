import React from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from './ChatContext';

const GroupChatDetails = () => {
    const { id } = useParams();
    const { chats } = useChat();
    const chat = chats.find(chat => chat.id === id);

    if (!chat) {
        return <div>No chat found for ID: {id}</div>;
    }

    return (
        <div className="group-chat-details">
            <h3>Chat Details: {chat.name}</h3>
            <div>Members:</div>
            <ul>
                {chat.users.map(user => (
                    <li key={user.id}>{user.name}</li>
                ))}
            </ul>
            <div>Messages:</div>
            <ul>
                {chat.messages.map(msg => (
                    <li key={msg.id}>{msg.text}</li>
                ))}
            </ul>
        </div>
    );
};

export default GroupChatDetails;
