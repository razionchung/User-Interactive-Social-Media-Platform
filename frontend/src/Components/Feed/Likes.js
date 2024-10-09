import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { useNavigate } from "react-router-dom";

const Likes = ({ post, handleLike }) => {
    const navigate = useNavigate();
    const likeText = `${post.likes.count} Likes ${(post.likes.count === 0 || (post.likes.isLiked && post.likes.count === 1)) ? '' : (post.likes.isLiked  ? '(You and others)' : '(others)')}`;

    return (
        <div className="like-section">
            {post.likes.isLiked ? (
                <FaHeart className="liked" onClick={() => handleLike(post.post_id)} />
            ) : (
                <FaRegHeart onClick={() => handleLike(post.post_id)} />
            )}
            <span onClick={() => navigate(`/${post.post_id}/likes`)}>
                {likeText}
            </span>
        </div>
    );
};
export default Likes;
