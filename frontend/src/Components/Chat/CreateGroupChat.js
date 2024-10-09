import React, { useEffect, useState } from 'react';
import { useChat } from './ChatContext';
import axios from 'axios';

const CreateGroupChat = ({ close }) => {
    const { socket, currentUser } = useChat();
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [users, setUsers] = useState([]);

    const handleUserToggle = userId => {
        setSelectedUsers(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleCreateGroup = () => {
        if (!groupName || selectedUsers.length === 0) {
            alert('Please enter a group name and select members.');
            return;
        }
        createGroupChat(groupName, selectedUsers);
        close(); // Close modal on successful creation
    };

    useEffect(() => {
        axios.get('http://localhost:8080/allUsers')
            .then(response => {
                setUsers(response.data.results);
            })
            .catch(error => {
                console.error('Error fetching users:', error);
            });
    }, []);

    const createGroupChat = (groupName, userIds) => {
        const url = 'http://localhost:8080/chatGroup?chatname=' + groupName + '&username=' + currentUser + '&others=' + userIds.join(',');
        axios.post(url)
            .then(response => {
                if (response.status === 200) {
                    alert('Group chat created successfully');
                    socket.emit('update-chat', response.data);
                } else {
                    throw new Error('Failed to create group chat');
                }
            })
            .catch(error => {
                console.error('Error creating group chat:', error);
            });
    };

    return (
        <div className="create-group-chat">
            <input
                type="text"
                placeholder="Group Name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
            />
            {users.map(user => (
                <div key={user.user_id} onClick={() => handleUserToggle(user.username)} className={`user-selection ${selectedUsers.includes(user.username) ? 'selected' : ''}`}>
                    {user.username}
                </div>
            ))}
            <button onClick={handleCreateGroup}>Create Group</button>
            <button onClick={close}>Close</button>
        </div>
    );
};

export default CreateGroupChat;