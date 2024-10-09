import React, { useState } from "react";

const Comments = ({ comments, postId, submitReply }) => {
    const [replyText, setReplyText] = useState("");
    const [showReplyBox, setShowReplyBox] = useState(false);

    const handleReplyChange = (e) => {
        setReplyText(e.target.value);
    };

    const handleReply = () => {
        submitReply(postId, replyText, null); // Reply directly to the post
        setReplyText("");
        setShowReplyBox(false);
    };

    return (
        <div>
            <div className="reply-to-post">
                <button onClick={() => setShowReplyBox(!showReplyBox)}>
                    Reply to Post
                </button>
            </div>
            {showReplyBox && (
                <div>
                    <input
                        type="text"
                        value={replyText}
                        onChange={handleReplyChange}
                        placeholder="Write a reply..."
                    />
                    <button onClick={handleReply}>Post</button>
                </div>
            )}
            {comments.map((comment) => (
                <Comment
                    key={comment.comment_id}
                    comment={comment}
                    postId={postId}
                    submitReply={submitReply}
                />
            ))}
        </div>
    );
};

const Comment = ({ comment, postId, submitReply }) => {
    const [replyText, setReplyText] = useState("");
    const [showReplyBox, setShowReplyBox] = useState(false);

    const handleReplyChange = (e) => {
        setReplyText(e.target.value);
    };

    const handleReply = () => {
        submitReply(postId, replyText, comment.comment_id); // Reply to this comment
        setReplyText("");
        setShowReplyBox(false);
    };

    return (
        <div style={{ marginLeft: "20px" }}>
            <div className="comment-content">
                <p>
                    {comment.username}: {comment.content}
                </p>
                <button
                    className="reply-button"
                    onClick={() => setShowReplyBox(!showReplyBox)}
                >
                    Reply
                </button>
            </div>
            {showReplyBox && (
                <div>
                    <input
                        type="text"
                        value={replyText}
                        onChange={handleReplyChange}
                        placeholder="Write a reply..."
                    />
                    <button onClick={handleReply}>Post</button>
                </div>
            )}
            {comment.children &&
                comment.children.map((child) => (
                    <div key={child.nested_comment_id} style={{ marginLeft: "40px" }}>
                        <p>
                            {child.username}: {child.content}
                        </p>
                    </div>
                ))}
        </div>
    );
};

export default Comments;
