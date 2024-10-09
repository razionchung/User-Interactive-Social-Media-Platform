import React, { useState } from 'react';
import { useChat } from './ChatContext';
import CreateGroupChat from './CreateGroupChat'; // Import the modal component

const ChatList = () => {
    const { chats, setCurrentChat } = useChat();
    const [showCreateGroup, setShowCreateGroup] = useState(false); // State to control modal visibility

    return (
        <div className="chat-list">
            <button onClick={() => setShowCreateGroup(true)}>Create New Chat</button>
            {showCreateGroup && <CreateGroupChat close={() => setShowCreateGroup(false)} />}

            {chats.map(chat => (
                <div key={chat.chat_id} onClick={() => setCurrentChat(chat)} className="chat-item">
                    {chat.chat_name}
                </div>
            ))}
        </div>
    );
};

export default ChatList;
