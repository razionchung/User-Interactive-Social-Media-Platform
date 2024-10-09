import React, { useState, useEffect } from "react";
import Posts from "./Post";
import axios from 'axios';
import config from '../../config.json';
import { getCookie } from '../../utils';
import "./Feed.css";

const Feed = () => {
    const [posts, setPosts] = useState([]);
    const currentUser = getCookie('username');
    useEffect(() => {
        const fetchFeed = async () => {
            try {
                const rootURL = config.serverRootURL;
                const response = await axios.get(`${rootURL}/${currentUser}/feed`, {
                    withCredentials: true
                });
                
                const fetchedPosts = await Promise.all(
                    response.data.results.map(async (post) => {
                        const likeCountResponse = await axios.get(`${rootURL}/${currentUser}/${post.post_id}/postLikeCount`);
                        const likeCount = likeCountResponse.data.likeCount;
    
                        const likedResponse = await axios.get(`${rootURL}/${currentUser}/${post.post_id}/postIsLiked`);
                        const isLiked = likedResponse.data.liked;

                        const commentsResponse = await axios.get(`${rootURL}/${currentUser}/${post.post_id}/comments`, { withCredentials: true });
                        const comments = commentsResponse.data.results;

                        const commentsWithNestedComments = await Promise.all(
                            comments.map(async (comment) => {
                                let nestedComments = []
                                if (comment.has_nested_comments) {
                                    const nestedCommentsResponse = await axios.get(`${rootURL}/${currentUser}/${comment.comment_id}/nestedComments`, { withCredentials: true });
                                    nestedComments = nestedCommentsResponse.data.results;
                                }
                                return { ...comment, children: nestedComments };
                            })
                        );
    
                        return {
                            ...post,
                            likes: {
                                count: likeCount,
                                // users: isLiked ? [currentUser] : [],
                                isLiked: isLiked,
                            },
                            comments: commentsWithNestedComments,
                        };
                    })
                );

                // const fetchedPosts = response.data.results.map((post) => ({
                //     ...post,
                //     likes: { count: 0, users: [] },
                //     comments: [],
                // }));
                setPosts(fetchedPosts);
            } catch (error) {
                console.error("Error fetching feed:", error);
            }
        };

        fetchFeed();
    }, [currentUser]);

    const handleLike = async (postId) => {
      
        try {
            const rootURL = config.serverRootURL;
            // const post = posts.find((post) => post.post_id === postId);
            const likedResponse = await axios.get(`${rootURL}/${currentUser}/${postId}/postIsLiked`);
            const isLiked = likedResponse.data.liked;
            const likeCountResponse = await axios.get(`${rootURL}/${currentUser}/${postId}/postLikeCount`);
            const likeCount = likeCountResponse.data.likeCount;
      
            const updatedPosts = posts.map((post) => {
                if (post.post_id === postId) {
                    const newCount = isLiked? likeCount-1 : likeCount+1;
                    // const newUsers = isLiked
                    //                  ? post.likes.users.filter((user) => user !== currentUser)
                    //                  : [...post.likes.users, currentUser];
      
                    return {
                        ...post,
                        likes: {
                            count: newCount,
                            // users: newUsers,
                            isLiked: !isLiked,
                        },
                    };
                }
                return post;
            });
            setPosts(updatedPosts);

            if (isLiked) {
                await axios.delete(`${rootURL}/${currentUser}/${postId}/postUnLike`);
            } else {
                await axios.post(`${rootURL}/${currentUser}/${postId}/postLike`);
            }
        } catch (error) {
            console.error("Error liking/unliking post:", error);
        }
    };

    const submitReply = async (postId, text, parentId) => {
        try {
            console.log(parentId);
            const rootURL = config.serverRootURL;
            const currentTimestamp = Date.now();
    
            if (parentId === null) {
                await axios.post(`${rootURL}/${currentUser}/comment`, {
                    post_id: postId,
                    content: text,
                    withCredentials: true
                });
    
                const newComment = {
                    comment_id: `new_comment_${currentTimestamp}`,
                    content: text,
                    elapsed_time: 0,
                    username: currentUser,
                    has_nested_comments: false,
                    children: [],
                };
    
                const updatedPosts = posts.map((post) => {
                    if (post.post_id === postId) {
                        return {
                            ...post,
                            comments: [newComment, ...post.comments],
                        };
                    }
                    return post;
                });
    
                setPosts(updatedPosts);
            } else {
                await axios.post(`${rootURL}/${currentUser}/nestedComment`, {
                    comment_id: parentId,
                    content: text,
                    withCredentials: true
                });
    
                const newNestedComment = {
                    nested_comment_id: `new_nested_comment_${currentTimestamp}`,
                    content: text,
                    elapsed_time: 0,
                    username: currentUser,
                };
    
                const updatedPosts = posts.map((post) => {
                    if (post.post_id === postId) {
                        const updatedComments = post.comments.map((comment) => {
                            if (comment.comment_id === parentId) {
                                return {
                                    ...comment,
                                    children: [newNestedComment, ...comment.children],
                                    has_nested_comments: true,
                                };
                            }
                            return comment;
                        });
                        return {
                            ...post,
                            comments: updatedComments,
                        };
                    }
                    return post;
                });
    
                setPosts(updatedPosts);
            }
        } catch (error) {
            console.error("Error submitting reply:", error);
        }
    };

    return (
        <div className="feed">
            <Posts posts={posts} handleLike={handleLike} submitReply={submitReply} />
        </div>
    );
};

export default Feed;
