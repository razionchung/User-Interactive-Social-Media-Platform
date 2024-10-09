// CreateChat.js
import React, { useState } from 'react';
import { useChat } from './ChatContext';

const CreateChat = () => {
    const { users, createGroupChat, setCurrentChat } = useChat();
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [chatName, setChatName] = useState('');

    const handleCreateChat = () => {
        if (selectedUsers.length > 0) {
            if (selectedUsers.length === 1) {
                // Create an individual chat
                const newChat = {
                    id: `chat_${Date.now()}`,
                    name: users.find(u => u.id === selectedUsers[0]).name,
                    users: selectedUsers,
                    messages: []
                };
                setCurrentChat(newChat); // Set it as current chat
            } else {
                // Create a group chat
                createGroupChat(chatName, selectedUsers);
            }
            setSelectedUsers([]);
            setChatName('');
        } else {
            alert('Please select at least one user.');
        }
    };

    const toggleUserSelection = (userId) => {
        setSelectedUsers(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    return (
        <div>
            {selectedUsers.length > 1 && (
                <input
                    type="text"
                    value={chatName}
                    onChange={(e) => setChatName(e.target.value)}
                    placeholder="Group Chat Name"
                />
            )}
            <div>
                {users.map(user => (
                    <div key={user.id} onClick={() => toggleUserSelection(user.id)}>
                        {user.name} {selectedUsers.includes(user.id) ? '✓' : ''}
                    </div>
                ))}
            </div>
            <button onClick={handleCreateChat}>Create Chat</button>
        </div>
    );
};

export default CreateChat;
