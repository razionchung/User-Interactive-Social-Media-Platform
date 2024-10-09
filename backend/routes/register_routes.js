const routes = require('./routes.js');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

module.exports = {
    register_routes
}

function register_routes(app) {
    // User's
    app.get('/hello', routes.get_helloworld);
    app.post('/login', routes.post_login);
    app.get('/logout', routes.post_logout);
    app.post('/register', upload.single('photo'), routes.post_register); 
    app.get('/faceMatching', routes.get_face_matching);
    app.post('/faceMatching', routes.post_face_matching);
    app.get('/:username/myProfile', routes.get_profile);
    app.post('/:username/updateProfile', routes.update_profile);
    app.get('/:username/get_matched_actors', routes.get_matched_actors);
    app.get('/relatedProfiles', routes.get_related_profiles);

    // Friend's
    app.get('/:username/friends', routes.get_friends);
    app.post('/:username/addFriend', routes.add_friend);
    app.post('/:username/removeFriend', routes.remove_friend);
    app.post('/:username/updateFriendRecs', routes.update_friend_recs);
    app.get('/:username/getFriendRecs', routes.get_friend_recs);
    app.get('/:username/getFollowedBy', routes.get_followers);
    app.get('/:username/feed', routes.get_feed); 
    app.post('/:username/movies', routes.get_movie);

    // Chats
    app.post('/chatGroup', routes.post_chat_group);
    app.post('/uploadChatProfile', upload.single('file'), routes.post_chat_profile);
    app.get('/chatGroups', routes.get_chat_groups);
    app.get('/chatParticipants', routes.get_all_users_in_chat_by_chat_id);
    app.get('/allUsers', routes.get_all_users);
    app.post('/chatMessage', routes.post_chat_message);
    app.get('/chatMessages', routes.get_chat_messages);
    app.post('/leaveChatGroup', routes.leave_chat_delete_if_empty);

    // Searching Posts
    app.get('/relatedPosts', routes.get_related_posts);

    // Newly added for the project
    app.get('/:username/:post_id/comments', routes.get_comments);
    app.get('/:username/:comment_id/nestedComments', routes.get_nested_comments);
    app.get('/:username/:post_id/postLikers', routes.get_post_likers);
    app.get('/:username/:post_id/postLikeCount', routes.get_post_likeCount);
    app.get('/:username/:post_id/images', routes.get_post_images);
    app.get('/:username/:post_id/hashtags', routes.get_post_hashtags);
    app.post('/:username/:post_id/postLike', routes.post_post_like);
    app.post('/:username/comment', routes.post_comment);
    app.post('/:username/nestedComment', routes.post_nested_comment);
    app.post('/:username/post', upload.array('photo'), routes.post_post);
    app.delete('/:username/:post_id/delete_post', routes.delete_post);
    app.delete('/:username/:post_id/:comment_id/delete_comment', routes.delete_comment);
    app.delete('/:username/:post_id/:nested_comment_id/delete_nested_comment', routes.delete_nested_comment);
    app.delete('/:username/:post_id/postUnLike', routes.delete_post_unlike);
    app.get('/:username/:post_id/postIsLiked', routes.get_post_is_liked);
    app.get('/:username/checkUser', routes.get_check_user);
}
  
