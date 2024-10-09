import React from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import Likes from "./Likes";
import Comments from "./Comments";
import "./Post.css";

const Posts = ({ posts, handleLike, submitReply }) => {
    console.log("Posts data:", posts);
    return (
        <div className="posts-container">
            {posts.map((post) => (
                <div className="post" key={post.post_id}>
                    <div className="post-header">
                        <h3>
                            <Link to={`/${post.username}/viewProfile`}>{post.username}</Link>
                        </h3>
                        <p className="timestamp">
                            Posted {moment(post.created_at).fromNow()}
                        </p>
                    </div>
                    {post.content && (
                        <p className="description">{post.content}</p>
                    )}
                    {post.photos && post.photos.length > 0 && (
                        <img src={post.photos[0]} className="post-image" alt="Post visual content" />
                    )}
                    <Likes post={post} handleLike={handleLike} />
                    <Comments
                        comments={post.comments}
                        postId={post.post_id}
                        submitReply={(postId, replyText, commentId) =>
                            submitReply(postId, replyText, commentId)
                        }
                    />
                </div>
            ))}
        </div>
    );
};

export default Posts;