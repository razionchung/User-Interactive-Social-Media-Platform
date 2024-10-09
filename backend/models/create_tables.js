const dbaccess = require('./db_access');
const config = require('../config.json'); // Load configuration

function sendQueryOrCommand(db, query, params = []) {
    return new Promise((resolve, reject) => {
      db.query(query, params, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  }

async function create_tables(db) {
  // These tables should already exist from prior homeworks.
  // We include them in case you need to recreate the database.

  // You'll need to define the names table.
  // var qa = db.create_tables('...');

  // var qb = db.create_tables('CREATE TABLE IF NOT EXISTS titles ( \
  //   tconst VARCHAR(10) PRIMARY KEY, \
  //   titleType varchar(255), \
  //   primaryTitle VARCHAR(255), \
  //   originalTitle VARCHAR(255), \
  //   startYear varchar(4), \
  //   endYear varchar(4), \
  //   genres VARCHAR(255) \
  //   );')

  //   var qc = db.create_tables('CREATE TABLE IF NOT EXISTS principals ( \
  //     tconst VARCHAR(10), \
  //     ordering int, \
  //     nconst VARCHAR(10), \
  //     category VARCHAR(255), \
  //     job VARCHAR(255), \
  //     characters VARCHAR(255), \
  //     FOREIGN KEY (tconst) REFERENCES titles(tconst), \
  //     FOREIGN KEY (nconst) REFERENCES names(nconst_short) \
  //     );')

    // Users table
    var q1_user = db.create_tables('CREATE TABLE IF NOT EXISTS users ( \
      user_id INT AUTO_INCREMENT PRIMARY KEY NOT NULL, \
      username VARCHAR(255), \
      hashed_password VARCHAR(255), \
      linked_nconst VARCHAR(10), \
      first_name VARCHAR(255), \
      last_name VARCHAR(255), \
      email VARCHAR(255), \
      affiliation VARCHAR(255), \
      birthday DATE, \
      profile_pic_url VARCHAR(255), \
      FOREIGN KEY (linked_nconst) REFERENCES names(nconst) \
    );');

    var q2_user = db.create_tables('CREATE TABLE IF NOT EXISTS user_hashtags ( \
      hashtag VARCHAR(255), \
      user_id INT, \
      username VARCHAR(255), \
      FOREIGN KEY (user_id) REFERENCES users(user_id), \
      FOREIGN KEY (username) REFERENCES users(username), \
      FOREIGN KEY (hashtag) REFERENCES postHashtag(hashtag) \
    );');

    // Friends table
    var q1_friends = db.create_tables('CREATE TABLE IF NOT EXISTS friends ( \
      followed VARCHAR(255), \
      follower VARCHAR(255), \
      FOREIGN KEY (follower) REFERENCES users(username), \
      FOREIGN KEY (followed) REFERENCES users(username) \
    );');

    var q2_friends = db.create_tables('CREATE TABLE IF NOT EXISTS recommendations ( \
      user VARCHAR(255), \
      recommendation VARCHAR(255), \
      strength int, \
      PRIMARY KEY (user, recommendation), \
      FOREIGN KEY (user) REFERENCES users(username), \
      FOREIGN KEY (recommendation) REFERENCES users(username) \
      );')
    
    // Below are Tables used in Feeds
    var q1_f = db.create_tables("CREATE TABLE IF NOT EXISTS post (" +
      "post_id INT PRIMARY KEY AUTO_INCREMENT," +
      "user_id INT," +
      "content TEXT," +
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
      "FOREIGN KEY (user_id) REFERENCES users(user_id)" +
    ");");

    var q2_f = db.create_tables("CREATE TABLE IF NOT EXISTS postPhotos (" +
      "photo_id INT PRIMARY KEY AUTO_INCREMENT," +
      "post_id INT," +
      "image_url VARCHAR(255)," +
      "FOREIGN KEY (post_id) REFERENCES post(post_id)" +
    ");");

    var q3_f = db.create_tables("CREATE TABLE IF NOT EXISTS postHashtag (" +
      "post_id INT," +
      "hashtag VARCHAR(255)," +
      "FOREIGN KEY (post_id) REFERENCES post(post_id)" +
    ");");

    var q4_f = db.create_tables("CREATE TABLE IF NOT EXISTS comment (" +
      "comment_id INT PRIMARY KEY AUTO_INCREMENT," +
      "post_id INT," +
      "username VARCHAR(255)," +
      "user_id INT," +
      "content TEXT," +
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
      "FOREIGN KEY (post_id) REFERENCES post(post_id)," +
      "FOREIGN KEY (user_id) REFERENCES users(user_id)" +
    ");");

    var q5_f = db.create_tables("CREATE TABLE IF NOT EXISTS nestedComment (" +
      "nested_comment_id INT PRIMARY KEY AUTO_INCREMENT," +
      "parent_comment_id INT," +
      "username VARCHAR(255)," +
      "user_id INT," +
      "content TEXT," +
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
      "FOREIGN KEY (user_id) REFERENCES users(user_id)," +
      "FOREIGN KEY (parent_comment_id) REFERENCES comment(comment_id)" +
    ");");

    var q6_f = db.create_tables("CREATE TABLE IF NOT EXISTS postLike (" +
      "like_id INT PRIMARY KEY AUTO_INCREMENT," +
      "post_id INT," +
      "user_id INT," +
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
      "FOREIGN KEY (post_id) REFERENCES post(post_id)," +
      "FOREIGN KEY (user_id) REFERENCES users(user_id)" +
    ");");

    var q7_f = db.create_tables("CREATE TABLE IF NOT EXISTS socialRank (" +
      "user_id INT," +
      "social_rank FLOAT," +
      "FOREIGN KEY (user_id) REFERENCES users(user_id)" +
    ");");

    var q8_c = db.create_tables("CREATE TABLE IF NOT EXISTS chats (" +
      "chat_id INT PRIMARY KEY AUTO_INCREMENT," +
      "chat_name VARCHAR(255)," +
      "created_by INT," +
      "FOREIGN KEY (created_by) REFERENCES users(user_id)" +
    ");");

    var q9_c = db.create_tables("CREATE TABLE IF NOT EXISTS messages (" +
      "message_id INT PRIMARY KEY AUTO_INCREMENT," +
      "chat_id INT," +
      "sent_by INT," +
      "message TEXT," +
      "timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
      "FOREIGN KEY (chat_id) REFERENCES chats(chat_id)," +
      "FOREIGN KEY (sent_by) REFERENCES users(user_id)" +
    ");");

    var q10_c = db.create_tables("CREATE TABLE IF NOT EXISTS chat_participants (" +
      "chat_id INT," +
      "user_id INT," +
      "FOREIGN KEY (chat_id) REFERENCES chats(chat_id)," +
      "FOREIGN KEY (user_id) REFERENCES users(user_id)" +
    ");");

    return await Promise.all([q1_user, q2_user, q1_friends, q2_friends, q1_f, q2_f, q3_f, q4_f, q5_f, q6_f, q7_f, q8_c, q9_c, q10_c]);
}

// Database connection setup
const db = dbaccess.get_db_connection();

var result = create_tables(dbaccess);
console.log('Tables created');
// dbaccess.close_db();

const PORT = config.serverPort;


