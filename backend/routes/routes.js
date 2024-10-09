// const { OpenAI, ChatOpenAI } = require("@langchain/openai");
// const { PromptTemplate } = require("@langchain/core/prompts");
// const { ChatPromptTemplate } = require("@langchain/core/prompts");
// const { StringOutputParser } = require("@langchain/core/output_parsers");
// const { CheerioWebBaseLoader } = require("langchain/document_loaders/web/cheerio");

// const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
// const { OpenAIEmbeddings } = require("@langchain/openai");
// const { MemoryVectorStore } = require("langchain/vectorstores/memory");
// const { createStuffDocumentsChain } = require("langchain/chains/combine_documents");
// const { Document } = require("@langchain/core/documents");
// const { createRetrievalChain } = require("langchain/chains/retrieval");
// const { formatDocumentsAsString } = require("langchain/util/document");
// const {
//     RunnableSequence,
//     RunnablePassthrough,
//   } = require("@langchain/core/runnables");
// const { Chroma } = require("@langchain/community/vectorstores/chroma");

const dbsingleton = require('../models/db_access.js');
const config = require('../config.json');
const bcrypt = require('bcrypt');
const helper = require('./route_helper.js');
const faceHelper = require('../faceapi/app.js');
var path = require('path');
const { ChromaClient } = require("chromadb");
const fs = require('fs');
const { OpenAIEmbeddingFunction } = require('chromadb');
const embeddingFunction = new OpenAIEmbeddingFunction({
  openai_api_key: process.env.OPENAI_API_KEY,
});
const { sendMessage } = require('../federated_posts/federated-posts-producer.js');
const { get } = require('http');

// Database connection setup
const db = dbsingleton;

const PORT = config.serverPort;


var getHelloWorld = function (req, res) {
  res.status(200).send({ message: "Hello, world!" });
}

var vectorStore = null

var getVectorStore = async function (req) {
  if (vectorStore == null) {
    vectorStore = await Chroma.fromExistingCollection(new OpenAIEmbeddings(), {
      collectionName: "imdb_reviews2",
      url: "http://localhost:8000", // Optional, will default to this value
    });
  }
  return vectorStore;
}

// POST /register 
var postRegister = async function (req, res) {
  const { username, password, first_name, last_name, email, affiliation, birthday } = req.body;
  const profile_pic = req.file;
  if (!username || !password || !first_name || !last_name || !email || !affiliation || !birthday || !profile_pic) {
    return res.status(400).json({ error: 'One or more of the fields you entered was empty, please try again.' });
  }
  try {
    const currUser = await db.send_sql(`SELECT * FROM users WHERE username = "${username}"`);
    if (currUser.length > 0) {
      return res.status(409).json({ error: 'An account with this username already exists, please try again.' });
    }
    const profile_pic_url = await helper.uploadProfilePicToS3(username, profile_pic);

    helper.encryptPassword(password, async (err, hash) => {
      if (err) {
        return res.status(500).json({ error: 'Error querying database.' });
      }
      try {
        const query = `INSERT INTO users (username, hashed_password, first_name, last_name, email, affiliation, birthday, profile_pic_url) \
                VALUES ("${username}", "${hash}", "${first_name}", "${last_name}", "${email}", "${affiliation}", "${birthday}", "${profile_pic_url}")`;
        await db.send_sql(query);

        const collection = await initializeOrGetChromaCollection("profile_embeddings");
        addTextEmbeddingToChromaDB(collection, username, username); // usernames are unique
        res.status(200).json({ username: username, profile_pic: profile_pic.path });
      } catch (err) {
        res.status(500).json({ error: 'Error querying database.' });
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error querying database.' });
  }
};

function sortUsers(users, orderedIds) {
  const userMap = new Map(users.map(user => [user.username, user]));
  const sortedUsers = orderedIds.map(username => userMap.get(username)).filter(Boolean);
}

const getRelatedProfiles = async (req, res) => {
  const collection = await initializeOrGetChromaCollection("profile_embeddings");
  console.log(await collection.peek())
  let { queryString } = req.query;
  if (!queryString) {
    return res.status(400).json({ error: "you must add a query" });
  }
  queryString = decodeURIComponent(queryString);
  try {
    const collection = await initializeOrGetChromaCollection("profile_embeddings");
    const queryEmbeddings = await embeddingFunction.generate(queryString);
    const searchResults = await collection.query({
      queryEmbeddings: queryEmbeddings,
      nResults: 5
    });

    if (searchResults.error && searchResults.error == 'InvalidDimension') {
      const client = new ChromaClient();
      collection.peek()
    }
    const users = searchResults.ids[0];
    const usersQuoted = users.map(user => `'${user}'`).join(', ');
    const userQuery = `
          SELECT username FROM users
          WHERE username IN (${usersQuoted});
      `;
    const relatedUsers = await db.send_sql(userQuery);
    // const sortedRelatedPosts = sortUsers(relatedUsers, users);
    // console.log(sortedRelatedPosts);
    res.json(relatedUsers);
  } catch (error) {
    console.error('Error searching for related posts:', error);
    res.status(500).json({ error: "Error retrieving related posts" });
  }
};


// GET /faceMatching
var getFaceMatching = async function (req, res) {
  const { username, profile_pic } = req.query;
  if (!username || !profile_pic) {
    return res.status(400).json({ error: 'Both username and profile_pic must be provided' });
  }

  try {
    var formatted_results = [];
    // Handling hashtags
    const query_top_10_hashtags = `SELECT hashtag, COUNT(*) as count FROM postHashtag
                                GROUP BY hashtag
                                ORDER BY count DESC
                                LIMIT 10;`;
    const hashtags = await db.send_sql(query_top_10_hashtags);
    formatted_results.push({ hashtags: hashtags.map(h => h.hashtag) });

    // Handling face matching
    const client = new ChromaClient();
    faceHelper.initializeFaceModels()
      .then(async () => {
        const collection = await client.getOrCreateCollection({
          name: "face-api",
          embeddingFunction: null,
          // L2 here is squared L2, not Euclidean distance
          metadata: { "hnsw:space": "l2" },
        });

        console.info("Looking for files");
        const promises = [];
        // Loop through all the files in the images directory
        fs.readdir("./faceapi/images", function (err, files) {
          if (err) {
            console.error("Could not list the directory.", err);
            process.exit(1);
          }

          files.forEach(function (file, index) {
            console.info("Adding task for " + file + " to index.");
            promises.push(faceHelper.indexAllFaces(path.join("./faceapi/images", file), file, collection));
          });
          console.info("Done adding promises, waiting for completion.");
          Promise.all(promises).then(async (results) => {
            console.info("All images indexed.");

            const imagePath = path.resolve(__dirname, '..', profile_pic);
            console.log('\nTop-k indexed matches to ' + username + ':');
            for (var item of await faceHelper.findTopKMatches(collection, imagePath, 5)) {
              for (var i = 0; i < item.ids[0].length; i++) {
                console.log(item.ids[0][i] + " (Euclidean distance = " + Math.sqrt(item.distances[0][i]) + ") in " + item.documents[0][i]);
                let actor_id = item.documents[0][i].split('.')[0];
                const actor_pic_url = await helper.uploadActorPicToS3(username, path.join("./faceapi/images", item.documents[0][i]), actor_id);
                formatted_results.push({
                  actor_id: actor_id,
                  distance: Math.sqrt(item.distances[0][i]),
                  image_url: actor_pic_url
                });
              }
            }
            console.log("Formatted results: ", formatted_results);
            res.status(200).json(formatted_results);
          }).catch((err) => {
            console.error("Error indexing images:", err);
          });
        });
      });

  } catch (error) {
    console.error('Error processing face matching:', error);
    res.status(500).json({ error: 'Internal server error while processing face matching.' });
  }
};

// POST /faceMatching
var postFaceMatching = async function (req, res) {
  const { username, actor_nconst, selectedHashtags } = req.body;
  if (!username || !actor_nconst) {
    return res.status(400).json({ error: 'Both username and actor_nconst must be provided' });
  }

  try {
    const userExists = await db.send_sql(`SELECT * FROM users WHERE username = "${username}"`);
    if (!userExists || userExists.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const linkActor = await db.send_sql(`UPDATE users SET linked_nconst = "${actor_nconst}" WHERE username = "${username}"`);
    if (!linkActor) {
      res.status(500).json({ error: 'Failed to update the actor link in the database' });
    }
    for (var i = 0; i < selectedHashtags.length; i++) {
      const hashTag = selectedHashtags[i];
      const linkHashTags = await db.send_sql(`INSERT INTO user_hashtags (user_id, username, hashtag) VALUES ("${userExists[0].user_id}", "${username}", "${hashTag}")`);
      if (!linkHashTags) {
        res.status(500).json({ error: `Failed to update the hashtag ${hashTag} in the database` });
      }
    }
    req.session.username = username;
    req.session.save(() => {
      req.app.io.emit('user online', { username: username });
      console.log(`Emitting 'user online' for user: ${username}`);
      res.status(200).json({ username: username });
    });
    // res.status(200).json({ message: 'Actor and hashtags linked successfully' });
  } catch (error) {
    console.error('Error processing face matching:', error);
    res.status(500).json({ error: 'Internal server error while linking actor.' });
  }
};

// POST /login
var postLogin = async function (req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'One or more of the fields you entered was empty, please try again.' });
  }
  try {
    const users = await db.send_sql(`SELECT * FROM users WHERE username = "${username}"`);
    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }
    const user = users[0];
    helper.checkPassword(password, user.hashed_password, async (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Check pw: Error querying database.' });
      } else if (result) {
        req.session.user_id = user.user_id;
        req.session.username = username;
        req.session.save(() => {
          req.app.io.emit('user online', { username: username });
          console.log(`Emitting 'user online' for user: ${username}`);
          res.status(200).json({ username: username });
        });
      } else {
        return res.status(401).json({ error: 'Username and/or password are invalid.' });
      }
    });
  } catch (err) {
    console.error("Database Error:", err);
    return res.status(500).json({ error: 'Error querying database.' });
  }
};


// GET /logout
var postLogout = function(req, res) {
  const username = req.session.username;
  req.session.user_id = null;
  req.session.username = null;
  req.session.save(() => {
      req.app.io.emit('user offline', {username: username});
      console.log(`Emitting 'user offline' for user: ${username}`);
      res.status(200).json({ message: 'You were successfully logged out.' });
  });
  // res.status(200).json({ message: 'You were successfully logged out.' });
};

// GET /:username/myProfile
var getProfile = async function(req, res) {
  const { username } = req.params;
  if (!helper.isLoggedIn(req, username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }

  try {
      const userProfile = await db.send_sql(`SELECT * FROM users WHERE username = "${username}"`);
      if (userProfile.length === 0) {
          return res.status(404).json({ error: 'User not found.' });
      }
      const user = userProfile[0];
      console.log(user);

      // Fetch hashtags
      const userHashtags = await db.send_sql(`SELECT hashtag FROM user_hashtags WHERE username = "${username}"`);
      const hashtags = userHashtags.map(h => h.hashtag);

      const fullName = user.first_name + ' ' + user.last_name;
      const linkedActorUrl = 'https://imdb-embeddings-upenn-nets2120-2024sp-cloudyssey.s3.amazonaws.com/' + user.username + '_' + user.linked_nconst + '.jpg';

      res.status(200).json({ 
          username: user.username, 
          full_name: fullName,
          email: user.email,
          affiliation: user.affiliation,
          birthday: user.birthday, 
          profile_pic_url: user.profile_pic_url,
          linked_nconst: user.linked_nconst,
          linked_actor_url: linkedActorUrl,
          hashtags: hashtags});
  } catch (error) {
      console.error('Database query error:', error);
      res.status(500).json({ error: 'Internal server error while fetching user profile.' });
  }
};

// GET /:username/getMatchedActors
var getMatchedActors = async function(req, res) {
  const { username } = req.params;
  if (!helper.isLoggedIn(req, username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  try {
      const images = await helper.getActorsPicFromS3(username);
      // current hashtags
      const query_hashtags = await db.send_sql(`SELECT hashtag FROM user_hashtags WHERE username = "${username}"`);
      const query_actor_nconst = await db.send_sql(`SELECT linked_nconst FROM users WHERE username = "${username}"`);
      const current_hashtags = query_hashtags.map(h => h.hashtag);
      let hashtags_rec = [];
      if (current_hashtags.length > 0) {
          const temp = query_hashtags.map(h => `'${h.hashtag}'`).join(", ");
          // hashtags recommendations: provide top 10 unsaved hashtags
          const query_hashtags_rec = await db.send_sql(`
                                      SELECT hashtag, COUNT(*) as count FROM postHashtag
                                      WHERE hashtag NOT IN (${temp})
                                      GROUP BY hashtag
                                      ORDER BY count DESC
                                      LIMIT 10;
                                      `);
          hashtags_rec = query_hashtags_rec.map(h => h.hashtag);
      } else {
          // if no current hashtags, fetch the top 10 used hashtags
          const query_hashtags_rec = await db.send_sql(`
                                      SELECT hashtag, COUNT(*) as count FROM postHashtag
                                      GROUP BY hashtag
                                      ORDER BY count DESC
                                      LIMIT 10;
                                      `);
          hashtags_rec = query_hashtags_rec.map(h => h.hashtag);
      }
      res.status(200).json({ 
          images: images,
          actor_nconst: query_actor_nconst,
          current_hashtags: current_hashtags,
          hashtags_rec: hashtags_rec
      });
  } catch (error) {
      res.status(500).send('Failed to retrieve images');
  }
};

// POST /:username/updateProfile
var updateProfile = async function(req, res) {
  const { username } = req.params;
  const { actor_nconst, email, newPassword, newHashtags } = req.body;
  if (!helper.isLoggedIn(req, username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }

  try {
      const userResult = await db.send_sql(`SELECT * FROM users WHERE username = "${username}"`);
      if (!userResult || userResult.length === 0) {
          return res.status(404).json({ error: 'User not found.' });
      }
      const user = userResult[0];

      // update email if provided
      if (email) {
          const updateEmail = await db.send_sql(`UPDATE users SET email = "${email}" WHERE username = "${username}"`);
          if (!updateEmail) {
              throw new Error('Failed to update email in the database');
          }
      }

      // update password if provided
      if (newPassword || newPassword.length > 0) {
          helper.encryptPassword(newPassword, async (err, hash) => {
              if (err) {
                  throw err;
              }
              const updatePassword = await db.send_sql(`UPDATE users SET hashed_password ="${hash}" WHERE username = "${username}"`);
              if (!updatePassword) {
                  throw new Error('Failed to update password in the database');
              }
          });
      }

      // update linked actor if provided
      if (actor_nconst) {
          const updateActor = await db.send_sql(`UPDATE users SET linked_nconst = "${actor_nconst}" WHERE username = "${username}"`);
          if (!updateActor) {
              throw new Error('Failed to update the associated actor in the database');
          } else {
              // TODO: create a post
          }
      }

      // update hashtags if provided
      const deleteOldHashtags = await db.send_sql(`DELETE FROM user_hashtags WHERE username = "${username}"`);
      if (!deleteOldHashtags) {
          throw new Error('Failed to delete old hashtags');
      }
      for (var i = 0; i < newHashtags.length; i++) {
          const hashTag = newHashtags[i];
          const updateHashtags = await db.send_sql(`INSERT INTO user_hashtags (user_id, username, hashtag) VALUES ("${user.user_id}", "${username}", "${hashTag}")`);
          if (!updateHashtags) {
              throw new Error(`Failed to update the hashtags in the database`);
          }
      }
      await db.send_sql('COMMIT');
      res.status(200).json({ message: 'Profile updated successfully.' });
  } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Internal server error while updating profile.' });
  }
};

// GET /:username/friends
var getFriends = async function(req, res) {
  const { username } = req.params;
  if (!helper.isLoggedIn(req, username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  try {
      const query = `
          SELECT u.username, u.first_name, u.last_name, u.profile_pic_url FROM users u
          JOIN friends f1 ON u.username = f1.followed AND f1.follower = '${username}'
          JOIN friends f2 ON f1.followed = f2.follower AND f2.followed = '${username}'
      `;
      const results = await db.send_sql(query);
      const response = {
          results: results.map(({ first_name, last_name, username, profile_pic_url }) => ({
              fullname: first_name + ' ' + last_name,
              username: username,
              profile_pic_url: profile_pic_url
          })),
      };
      res.status(200).json(response);
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error querying database.' });
  }
}

// GET /:username/followers
var getFollowers = async function(req, res) {
    const { username } = req.params;
    // req.session.username = username; // TODO: remove this line
    if (!helper.isLoggedIn(req, username)) {
        return res.status(403).json({ error: 'Not logged in.' });
    }
    try {
        const query = `
            SELECT u.username, u.first_name, u.last_name, u.profile_pic_url FROM users u
            JOIN friends f ON u.username = f.follower AND f.followed = '${username}'
            WHERE NOT EXISTS (
                SELECT 1 FROM friends f2
                WHERE f2.follower = '${username}' AND f2.followed = u.username
            )
        `;
        const results = await db.send_sql(query);
        const response = {
            results: results.map(({ first_name, last_name, username, profile_pic_url }) => ({
                fullname: first_name + ' ' + last_name,
                username: username,
                profile_pic_url: profile_pic_url
            })),
        };
        res.status(200).json(response);
    } catch {
        console.log(err);
        res.status(500).json({ error: 'Error querying database.' });
    }
}

// GET /:username/getFriendRecs
var getFriendRecs = async function(req, res) {
    const { username } = req.params;
    // req.session.username = username; // TODO: remove this line 
    if (!helper.isLoggedIn(req, username)) {
        return res.status(403).json({ error: 'Not logged in.' });
    }

    try {
        const query =  `
            SELECT u.username, u.first_name, u.last_name, u.profile_pic_url, r.strength FROM users u
            JOIN recommendations r ON u.username = r.recommendation
            WHERE r.user = '${username}'
            UNION
            SELECT u.username, u.first_name, u.last_name, u.profile_pic_url, 0 AS strength FROM users u
            JOIN (
                SELECT followed, COUNT(follower) AS follower_count
                FROM friends
                GROUP BY followed
                ORDER BY follower_count DESC
                LIMIT 5
            ) top_users ON u.username = top_users.followed
            WHERE u.username NOT IN (
                SELECT followed FROM friends WHERE follower = '${username}'
            )
            AND u.username NOT IN (
                SELECT recommendation FROM recommendations WHERE user = '${username}'
            )
            AND u.username != '${username}' 
        `;

        const results = await db.send_sql(query);
        const response = {
            results: results.map(({ first_name, last_name, username, profile_pic_url, strength }) => ({
                fullname: first_name + ' ' + last_name,
                username: username,
                profile_pic_url: profile_pic_url,
                strength: strength // 0 for Top Influencer
            })),
        };
        res.status(200).json(response);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error querying database.' });
    }
}

// POST /:username/updateFriendRecs
var updateFriendRecs = async function(req, res) {
  // TODO: include social rank
  const { username } = req.params;
  req.session.username = username; // TODO: remove this line
  if (!helper.isLoggedIn(req, username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  // Use friend-of-friend algorithm to populate recommendations table
  try {
      await db.send_sql('TRUNCATE TABLE recommendations');
      console.log('Recommendations table successfully truncated.');

      // 1. create followed map
      const followedMap = new Map();
      const queryFriendsPair = await db.send_sql(`SELECT follower, followed FROM friends`);
      queryFriendsPair.forEach(row => {
          const { follower, followed } = row;
          if (!followedMap.has(follower)) {
              followedMap.set(follower, new Set());
          }
          followedMap.get(follower).add(followed);
      });
      // 2. create friend-of-friend map
      const recommendations = new Map();
      followedMap.forEach((followedSet, follower) => {
          const recommendationMap = new Map(); // map of recommended person to strength of recommendation
          followedSet.forEach(followed => {
              if (followedMap.has(followed)) {
                  followedMap.get(followed).forEach(recommendation => {
                      if (recommendation !== follower && !followedSet.has(recommendation)) {
                          recommendationMap.set(recommendation, (recommendationMap.get(recommendation) || 0) + 1);
                      }
                  });
              }
          });
          if (recommendationMap.size > 0) {
              recommendations.set(follower, recommendationMap);
          }
      });
      // 3. update recommendations table
      for (const [user, recMap] of recommendations.entries()) {
          for (const [recommendation, strength] of recMap.entries()) {
              await db.send_sql(`
                  INSERT INTO recommendations (user, recommendation, strength) VALUES ("${user}", "${recommendation}", ${strength});
              `);
          }
      }
      res.status(200).json({ message: "Recommendations successfully updated!" });
  } catch (error) {
      console.error('Error processing friend recommendations:', error);
      res.status(500).json({ error: 'Failed to update friend recommendations' });
  }
}

async function updateFriendRecommendations(db) {
    await db.send_sql('TRUNCATE TABLE recommendations');
    console.log('Recommendations table successfully truncated.');
    // 1. create followed map
    const followedMap = new Map();
    const queryFriendsPair = await db.send_sql(`SELECT follower, followed FROM friends`);
    queryFriendsPair.forEach(row => {
        const { follower, followed } = row;
        if (!followedMap.has(follower)) {
            followedMap.set(follower, new Set());
        }
        followedMap.get(follower).add(followed);
    });
    // 2. create friend-of-friend map
    const recommendations = new Map();
    followedMap.forEach((followedSet, follower) => {
        const recommendationMap = new Map(); // map of recommended person to strength of recommendation
        followedSet.forEach(followed => {
            if (followedMap.has(followed)) {
                followedMap.get(followed).forEach(recommendation => {
                    if (recommendation !== follower && !followedSet.has(recommendation)) {
                        recommendationMap.set(recommendation, (recommendationMap.get(recommendation) || 0) + 1);
                    }
                });
            }
        });
        if (recommendationMap.size > 0) {
            recommendations.set(follower, recommendationMap);
        }
    });
    // 3. update recommendations table
    for (const [user, recMap] of recommendations.entries()) {
        for (const [recommendation, strength] of recMap.entries()) {
            await db.send_sql(`
                INSERT INTO recommendations (user, recommendation, strength) VALUES ("${user}", "${recommendation}", ${strength});
            `);
        }
    }
}

// POST /addFriend
var addFriend = async function(req, res) {
  const { username } = req.params;
  const { friend_username } = req.body;
  if (!username || !friend_username) {
      return res.status(400).json({ error: 'Invalid request data.' });
  }
  if (!helper.isLoggedIn(req, username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  if (username === friend_username) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend.' });
  }

  try {
      const exists = await db.send_sql(`SELECT * FROM friends WHERE follower = "${username}" AND followed = "${friend_username}"`);
      if (exists.length > 0) {
          return res.status(409).json({ message: 'Friendship already exists.' });
      }
      const results = await db.send_sql(`INSERT INTO friends (follower, followed) VALUES ("${username}", "${friend_username}")`);
      if (results) {
          await updateFriendRecommendations(db);
          return res.status(200).json({ message: `${username} added ${friend_username} successfully.` });
      } else {
          return res.status(500).json({ error: `Failed to add ${friend_username}.` });
      }
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error querying database.' });
  }
}

// POST /removeFriend
var removeFriend = async function(req, res) {
  const { username } = req.params;
  const { friend_username } = req.body;
  console.log(req.params);
  console.log(req.body);
  if (!username || !friend_username || username === friend_username) {
      return res.status(400).json({ error: 'Invalid request data.' });
  }
  if (!helper.isLoggedIn(req, username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  try {
      const exists = await db.send_sql(`SELECT * FROM friends WHERE follower = "${username}" AND followed = "${friend_username}"`);
      if (exists.length === 0) {
          return res.status(404).json({ message: 'No such friendship exists.' });
      }
      const results = await db.send_sql(`DELETE FROM friends WHERE follower = "${username}" AND followed = "${friend_username}"`);
      if (results) {
          await updateFriendRecommendations(db);
          return res.status(200).json({ message: `${username} removed ${friend_username} successfully.` });
      } else {
          return res.status(500).json({ error: `Failed to remove ${friend_username}.` });
      }
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error querying database.' });
  }
}

// GET /feed
var getFeed = async function(req, res) {
  const { username } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
  try {
      const query = `
          SELECT * FROM (
              SELECT p.post_id, u.username, p.content, p.created_at,
                  GROUP_CONCAT(DISTINCT ph.image_url ORDER BY ph.image_url) AS photos,
                  GROUP_CONCAT(DISTINCT ht.hashtag ORDER BY ht.hashtag) AS hashtags
              FROM post p
              JOIN users u ON p.user_id = u.user_id
              LEFT JOIN postPhotos ph ON p.post_id = ph.post_id
              LEFT JOIN postHashtag ht ON p.post_id = ht.post_id
              WHERE p.user_id = '${user_id}' OR p.user_id IN (
                  SELECT u1.user_id
                  FROM friends f
                  JOIN users u1 ON u1.username = f.followed
                  WHERE f.follower = '${username}'
              )
              GROUP BY p.post_id
              UNION ALL
              SELECT p.post_id, u.username, p.content, p.created_at,
                  GROUP_CONCAT(DISTINCT ph.image_url ORDER BY ph.image_url) AS photos,
                  GROUP_CONCAT(DISTINCT ht.hashtag ORDER BY ht.hashtag) AS hashtags
              FROM (
                  SELECT post_id
                  FROM post
                  WHERE user_id IN (64, 65)
                  ORDER BY RAND()
                  LIMIT 15
              ) AS limited_posts
              JOIN post p ON limited_posts.post_id = p.post_id
              JOIN users u ON p.user_id = u.user_id
              LEFT JOIN postPhotos ph ON p.post_id = ph.post_id
              LEFT JOIN postHashtag ht ON p.post_id = ht.post_id
              GROUP BY p.post_id
          ) AS result
          ORDER BY created_at DESC;
      `;
      console.log("ok");
      const results = await db.send_sql(query);
      console.log("ok1");
      const response = {
          results: results.map(({ post_id, username, content, created_at, photos, hashtags }) => ({
              post_id: post_id,
              username: username,
              content: content,
              created_at: created_at,
              photos: photos ? photos.split(',') : [],
              hashtags: hashtags ? hashtags.split(',') : [],
          })),
      };
      res.status(200).json(response);

  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
};



var getMovie = async function(req, res) {
  const vs = await getVectorStore();
  const retriever = vs.asRetriever();

  const prompt =
  PromptTemplate.fromTemplate(`Given the following context, provide an answer to the question specified below:
                              Here is the context: {context}
                              This is the question: {question}`);
  const llm = new ChatOpenAI({ temperature: 0 });; // TODO: replace with your language model

  const ragChain = RunnableSequence.from([
      {
          context: retriever.pipe(formatDocumentsAsString),
          question: new RunnablePassthrough(),
        },
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  console.log(req.body.question);

  result = await ragChain.invoke(req.body.question);
  console.log(result);
  res.status(200).json({message:result});
}

// GET /comments
var getComments = async function(req, res) {
  
  const { username, post_id } = req.params;
  
  try {
      const query = `
          SELECT
              c.comment_id,
              c.content, 
              TIMESTAMPDIFF(SECOND, c.created_at, CURRENT_TIMESTAMP()) AS elapsed_time, 
              u.username, 
              CASE WHEN nc.nested_comment_count > 0 THEN true ELSE false END AS has_nested_comments
          FROM comment c
              JOIN users u on u.user_id = c.user_id
              LEFT JOIN (
                  SELECT nc.parent_comment_id, COUNT(*) AS nested_comment_count
                  FROM nestedComment as nc
                  GROUP BY nc.parent_comment_id
              ) nc ON nc.parent_comment_id = c.comment_id
          WHERE c.post_id = '${post_id}'
          ORDER BY c.created_at DESC
      `;
      const results = await db.send_sql(query);
      const response = {
          results: results.map(({ comment_id, content, elapsed_time, username, has_nested_comments }) => ({
              comment_id,
              content,
              elapsed_time,
              username,
              has_nested_comments
          })),
      };
      res.status(200).json(response);
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

// GET /nestedComments
var getNestedComments = async function(req, res) {
  const { username, comment_id } = req.params;
  try {
    const query = `
      SELECT 
          nc.nested_comment_id,
          nc.content,
          TIMESTAMPDIFF(SECOND, nc.created_at, CURRENT_TIMESTAMP()) AS elapsed_time,
          u.username
      FROM nestedComment nc
      JOIN users u ON u.user_id = nc.user_id
      WHERE nc.parent_comment_id = '${comment_id}'
      ORDER BY nc.created_at DESC
      `;
      const results = await db.send_sql(query);
      const response = {
          results: results.map(({ nested_comment_id, content, elapsed_time, username }) => ({
              nested_comment_id,
              content,
              elapsed_time,
              username,
          })),
      };
      res.status(200).json(response);
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

// GET /likers
var getPostLikers = async function(req, res) {
  
  console.log("entered endpoint");
  const { username, post_id } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }

  try {
      const query = `
          SELECT 
              pl.like_id,
              u.username AS liker_username,
              u.profile_pic_url AS profile_pic_url
          FROM postLike pl 
          JOIN users u ON u.user_id = pl.user_id
          WHERE pl.post_id = '${post_id}'
          ORDER BY pl.created_at DESC;
      `;
      const results = await db.send_sql(query);
      const response = {
          results: results.map(({ like_id, liker_username, profile_pic_url }) => ({
              like_id,
              liker_username,
              profile_pic_url
          })),
      };
      console.log(response);
      res.status(200).json(response);
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

// GET /post like count
var getPostLikeCount = async function(req, res) {

  const { username, post_id } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }

  try {
      const query = `
          SELECT COUNT(*) AS likeCount
          FROM postLike pl
          WHERE pl.post_id = '${post_id}';
      `;
      const results = await db.send_sql(query);
      const response = { likeCount : results[0].likeCount };
      res.status(200).json(response);
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

// GET /post image
var getPostImages = async function(req, res) {

  const { username, post_id } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }

  try {
      const query1 = `
          SELECT p.image_url
          FROM postPhotos p
          WHERE p.post_id = '${post_id}'
          ORDER BY p.photo_id ASC;
      `;
      const query2 = `
          SELECT COUNT(*) AS imageCount
          FROM postPhotos p
          WHERE p.post_id = '${post_id}'
          GROUP BY p.post_id
      `;
      const [imagesResults, countResults] = await Promise.all([
          db.send_sql(query1),
          db.send_sql(query2)
      ]);
      const response = {
          results: imagesResults.map(({ image }) => ({
              image
          })),
          image_count: countResults[0],
      };
      res.status(200).json(response);
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

// GET /post hashtags
var getPostHashtags = async function(req, res) {

  const { username, post_id } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }

  try {
      const query = `
          SELECT h.hashtag
          FROM postHashtag h
          WHERE h.post_id = '${post_id}'
          ORDER BY BINARY h.hashtag ASC;
      `;
      const results = await db.send_sql(query);
      const response = {
          results: query.map(({ hashtag }) => ({
              hashtag
          })),
      };
      res.status(200).json(response);
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

// POST /like post
var postPostLike = async function(req, res) {

  const { username, post_id } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }

  try {
      const query = `INSERT INTO postLike (post_id, user_id) VALUES ('${post_id}', '${user_id}')`;
      await db.send_sql(query);
      res.status(201).json({ message: 'Post Liked.' });
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

// POST /comment
var postComment = async function(req, res) {

  const { username } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }

  const { post_id, content } = req.body;

  try {
      const query = `INSERT INTO comment (post_id, username, user_id, content) VALUES ('${post_id}', '${username}', '${user_id}', '${content}')`;
      await db.send_sql(query);
      res.status(201).json({ message: 'Comment Posted.' });
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

// POST /nestedComment
var postNestedComment = async function(req, res) {

  const { username } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }

  const { comment_id, content } = req.body;

  console.log(comment_id);
  console.log(content);

  try {
      const query = `INSERT INTO nestedComment (parent_comment_id, username, user_id, content) VALUES ('${comment_id}', '${username}', '${user_id}', '${content}')`;
      await db.send_sql(query);
      res.status(201).json({ message: 'Nested omment Posted.' });
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}
async function initializeOrGetChromaCollection(collectionName) {
  const client = new ChromaClient();
  console.log(`new chroma client created: ${client}`)
  return client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction: embeddingFunction,
      metadata: { "hnsw:space": "cosine" }
  });
}

async function addTextEmbeddingToChromaDB(collection, text, postId) {
  const embeddings = await embeddingFunction.generate([text]);
  console.log(embeddings);

  const data = {
      ids: [postId.toString()], 
      embeddings: embeddings,
      documents: [text]
  };
  await collection.add(data);
}

// POST /post
var postPost = async function(req, res) {

  const { username } = req.params;
  console.log(username);
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
  console.log(user_id);
  const { content, hashtags } = req.body;
  const photos = req.files;

  if (!content && !hashtags && !photos) {
      res.status(500).json({ error: 'Empty Post Content is Invalid.' });
  }

  try {
      const postQuery = `
          INSERT INTO post (user_id, content)
          VALUES ('${user_id}', '${content}');
      `;
      const postResult = await db.send_sql(postQuery);
      const postId = postResult.insertId;

      let attach = null;

      const collection = await initializeOrGetChromaCollection("post_embeddings");
      addTextEmbeddingToChromaDB(collection, content, postId);

      if (photos && photos.length > 0) {
          const uploadPromises = photos.map((photo, index) => {
              const key_val = `${username}${postId}${index}`;
              return helper.uploadFeedPicToS3(key_val, photo)
                  .then((photo_url) => {
                      attach = photo_url;
                      console.log("Photo url:" + attach);
                      return db.send_sql(`
                          INSERT INTO postPhotos (post_id, image_url)
                          VALUES ('${postId}', '${photo_url}');
                  `);
              });
          });
        
          Promise.all(uploadPromises).catch((error) => {
              console.error('Error uploading or inserting photos:', error);
          });
      }

      if (hashtags) {
          const hashtagsArray = hashtags.split(',').map(hashtag => hashtag.trim());
          for (const hashtag of hashtagsArray) {
              await db.send_sql(`
                  INSERT INTO postHashtag (post_id, hashtag)
                  VALUES ('${postId}', '${hashtag.trim()}');
              `);
          }
      }

      const message = {
          username: username,
          source_site: 'g29',
          post_uuid_within_site: postId,
          post_text: content,
          content_type: 'text/html',
      };

      console.log(message);
      
      await sendMessage(message, attach);

      res.status(201).json({ message: 'Post created successfully', postId });
  } catch (err) {
      console.error('Error creating post:', err);
      res.status(500).json({ error: 'Error querying database.' });
  }
};

// DELETE /post
var deletePost = async function(req, res) {
  const { username } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }

  const post_id = req.params.post_id;

  try {
      // Check if the post belongs to the logged-in user
      const checkPostQuery = `
      SELECT user_id FROM post WHERE id = '${post_id}';
      `;
      const checkPostResult = await db.send_sql(checkPostQuery);

      if (checkPostResult.length === 0) {
      return res.status(404).json({ error: 'Post not found.' });
      }

      if (checkPostResult[0].user_id !== user_id) {
      return res.status(403).json({ error: 'Not authorized to delete this post.' });
      }

      // Delete the post's photos from the postPhotos table
      const deletePhotosQuery = `
      DELETE FROM postPhotos WHERE post_id = '${post_id}';
      `;
      await db.send_sql(deletePhotosQuery);

      // Delete the post's hashtags from the postHashtag table
      const deleteHashtagsQuery = `
      DELETE FROM postHashtag WHERE post_id = '${post_id}';
      `;
      await db.send_sql(deleteHashtagsQuery);

      // Delete the post from the post table
      const deletePostQuery = `
      DELETE FROM post WHERE id = '${post_id}';
      `;
      await db.send_sql(deletePostQuery);

      res.status(200).json({ message: 'Post deleted successfully' });
  } catch (err) {
      console.error('Error deleting post:', err);
      res.status(500).json({ error: 'Error querying database.' });
  }
};

// DELETE /:username/:post_id/:comment_id/delete_comment
var deleteComment = async function(req, res) {
  const { username } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }

  const { post_id, comment_id } = req.params;

  try {
      // Check if the comment belongs to the logged-in user
      const checkCommentQuery = `
          SELECT user_id FROM comment WHERE comment_id = '${comment_id}';
      `;
      const checkCommentResult = await db.send_sql(checkCommentQuery);

      if (checkCommentResult.length === 0) {
          return res.status(404).json({ error: 'Comment not found.' });
      }

      if (checkCommentResult[0].user_id !== user_id) {
          return res.status(403).json({ error: 'Not authorized to delete this comment.' });
      }

      // Delete the comment from the comment table
      const deleteCommentQuery = `
          DELETE FROM comment WHERE comment_id = '${comment_id}';
      `;
      await db.send_sql(deleteCommentQuery);

      res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (err) {
      console.error('Error deleting comment:', err);
      res.status(500).json({ error: 'Error querying database.' });
  }
};

// DELETE /:username/:nested_comment_id/delete_nested_comment
var deleteNestedComment = async function(req, res) {
  const { username, nested_comment_id } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }

  try {
      // Check if the comment belongs to the logged-in user
      const checkCommentQuery = `
          SELECT user_id FROM nestedComment WHERE nested_comment_id = '${nested_comment_id}';
      `;
      const checkCommentResult = await db.send_sql(checkCommentQuery);

      if (checkCommentResult.length === 0) {
          return res.status(404).json({ error: 'Nested comment not found.' });
      }

      if (checkCommentResult[0].user_id !== user_id) {
          return res.status(403).json({ error: 'Not authorized to delete this nested comment.' });
      }

      // Delete the comment from the comment table
      const deleteCommentQuery = `
          DELETE FROM nestedComment WHERE nested_comment_id = '${nested_comment_id}';
      `;
      await db.send_sql(deleteCommentQuery);

      res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (err) {
      console.error('Error deleting comment:', err);
      res.status(500).json({ error: 'Error querying database.' });
  }
};

// DELETE /post/unlike
var deletePostUnlike = async function(req, res) {
  const { username, post_id } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }

  try {
      const unlikeQuery = `
          DELETE FROM postLike WHERE post_id = '${post_id}' AND user_id = '${user_id}';
      `;
      await db.send_sql(unlikeQuery);
      res.status(200).json({ message: 'Post unliked successfully' });
  } catch (err) {
      console.error('Error unliking post:', err);
      res.status(500).json({ error: 'Error querying database.' });
  }
};

var postChatGroup = async function(req, res) {
  const { username, chatname, others } = req.query;
  if (!helper.isOK(username)) {
    return res.status(403).json({ error: 'Not logged in.' });
  }

  // Query for the user id corresponding to the provided username
  let user_id = await getUserIdFromUserNameViaSQLQuery(username);
  const otherUsernames = others ? others.split(',') : [];
  let otherUserIds = [];

    for (const otherUsername of otherUsernames) {
      try {
        otherUserId = await getUserIdFromUserNameViaSQLQuery(otherUsername);
        otherUserIds.push(otherUserId);
      } catch (err) {
        res.status(500).json({ error: `Error querying database for user ${otherUsername}.` });
      }
    }

  console.log(`other user ids: ${otherUserIds}`)

  try {
    // update the chats table with the chat name and the user id of the user who created the chat
    const query = `INSERT INTO chats (chat_name, created_by) VALUES ('${chatname}', '${user_id}')`;
    await db.send_sql(query);

    // for both the creator and all the other users, insert a row into the chat_participants table
    const insertCreatorQuery = `INSERT INTO chat_participants (chat_id, user_id) VALUES (LAST_INSERT_ID(), '${user_id}')`;
    await db.send_sql(insertCreatorQuery);
    for (const otherUserId of otherUserIds) {
      try {
        const insertParticipantQuery = `INSERT INTO chat_participants (chat_id, user_id) VALUES (LAST_INSERT_ID(), '${otherUserId}')`;
        await db.send_sql(insertParticipantQuery);
      } catch (err) {
        res.status(500).json({ error: 'Error querying database.' });
      }
    }

    res.status(201).json({ message: 'Group chat created' });
  } catch (err) {
    res.status(500).json({ error: 'Error querying database.' });
  }

}

var leaveAndDeleteIfEmptyChatGroup = async function(req, res) {
const { chat_id, username } = req.body;
if (!chat_id || !username) {
    return res.status(400).json({ error: 'Chat ID and User ID are required.' });
}

try {

  const user_id = await getUserIdFromUserNameViaSQLQuery(username);
  if (!user_id) {
      return res.status(404).json({ error: 'User not found.' });
  }

  if (!helper.isLoggedIn(req, user_id)) {
    return res.status(403).json({ error: 'Not logged in.' });
  }

  // Remove the user from the chat participants
  const removeUserQuery = `DELETE FROM chat_participants WHERE user_id = ${user_id} AND chat_id = ${chat_id}`;
  await db.send_sql(removeUserQuery);

  // Check if there are any users left in the chat
  const remainingUsersQuery = `SELECT COUNT(*) AS count FROM chat_participants WHERE chat_id = ${chat_id}`;
  const remainingUsersResults = await db.send_sql(remainingUsersQuery);
  if (remainingUsersResults[0].count === 0) {
    // If no users left, delete the chat
    const deleteMessagesQuery = `DELETE FROM messages WHERE chat_id = ${chat_id}`;
    await db.send_sql(deleteMessagesQuery);

    const deleteChatQuery = `DELETE FROM chats WHERE chat_id = ${chat_id}`;
    await db.send_sql(deleteChatQuery);
res.status(200).json({ message: 'Chat deleted as last participant left.' });
  } else {
    res.status(200).json({ message: 'User removed from chat.' });
  }
} catch (err) {
  console.error('Error querying database:', err);
  res.status(500).json({ error: 'Failed to leave chat.' });
}

}

var getChatGroups = async function(req, res) {
  const { username } = req.query;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  try {
      const query = `
          SELECT c.chat_id, c.chat_name, c.icon_img_url
          FROM chats c
          JOIN chat_participants cp ON c.chat_id = cp.chat_id
          JOIN users u ON cp.user_id = u.user_id
          WHERE u.username = '${username}';
      `;
      const results = await db.send_sql(query);
      const response = {
          results: results.map(({ chat_id, chat_name, icon_img_url }) => ({
              chat_id: chat_id,
              chat_name: chat_name,
              icon_img_url: icon_img_url
          })),
      };
      res.status(200).json(response);
  } catch(err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

var getAllUsersInChatByChatId = async function(req, res) {
  const { chat_id } = req.query;
  try {
      const query = `
          SELECT u.username, profile_pic_url
          FROM users u
          JOIN chat_participants cp ON u.user_id = cp.user_id
          WHERE cp.chat_id = '${chat_id}';
      `;
      const results = await db.send_sql(query);
      const response = {
          results: results.map(({ username, profile_pic_url }) => ({
              username: username,
              profile_pic_url, profile_pic_url
          })),
      };
      res.status(200).json(response);
  } catch(err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

var postUploadChatProfile = async function (req, res) {
const { chat_id } = req.body;
const profile_pic = req.file;
if (!chat_id || !profile_pic) {
  return res.status(400).json({ error: 'Chat ID or profile image not provided.' });
}
try {
  const profile_pic_url = await helper.uploadChatProfilePicToS3(chat_id, profile_pic);
  const updateQuery = `UPDATE chats SET icon_img_url = '${profile_pic_url}' WHERE chat_id = ${chat_id}`;
  await db.send_sql(updateQuery);

  res.status(201).json({ chat_id: chat_id, profile_pic_url: profile_pic_url });
} catch (err) {
  console.log(err);
  res.status(500).json({ error: 'Failed to upload image or to update database.' });
}
};

var getChatMessages = async function(req, res) {
  const { chat_id } = req.query;
  try {
      const query = `
          SELECT m.message, u.username
          FROM messages m
          JOIN users u ON m.sent_by = u.user_id
          WHERE m.chat_id = '${chat_id}';
      `;
      const results = await db.send_sql(query);
      const response = {
          results: results.map(({ message, username }) => ({
              message: message,
              username: username
          })),
      };
      res.status(200).json(response);
  } catch(err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

const getAllUsers = async function(req, res) {
  try {
      const query = `
          SELECT username, user_id
          FROM users;
      `;
      const results = await db.send_sql(query);
      console.log(results)
      const response = {
          results: results
      };
      res.status(200).json(response);
  } catch(err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

var postChatMessage = async function(req, res) {
  const { chat_id, username, message } = req.body;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  try {
      const user_id = await getUserIdFromUserNameViaSQLQuery(username);
      const query = `INSERT INTO messages (chat_id, sent_by, message) VALUES ('${chat_id}', '${user_id}', '${message}')`;
      await db.send_sql(query);
      res.status(201).json({ message: 'Message sent' });
  } catch(err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
}

const getUserIdFromUserNameViaSQLQuery = async (username) => {
  let user_id;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          throw new Error('No user found with the given username.');
      }
  } catch (err) {
      throw new Error('Error querying database.');
  }
  return user_id;
};
// GET /postIsLiked
var getPostIsLiked = async function(req, res) {
  const { username, post_id } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      if (results.length > 0) {
          user_id = results[0].user_id;
      } else {
          console.log('No user found with the given username.');
      }
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }

  try {
      const query = `
          SELECT COUNT(*) AS liked 
          FROM postLike 
          WHERE post_id = '${post_id}' AND user_id = '${user_id}';
      `;
      const results = await db.send_sql(query);
      const liked = results[0].liked > 0;
      res.status(200).json({ liked });
  } catch (err) {
      console.error('Error unliking post:', err);
      res.status(500).json({ error: 'Error querying database.' });
  }
};

const getRelatedPosts = async (req, res) => {
  const collection = await initializeOrGetChromaCollection("post_embeddings");
  console.log(await collection.peek())
  let { queryString } = req.query;
  if (!queryString) {
      return res.status(400).json({ error: "you must add a query" });
  }
  queryString = decodeURIComponent(queryString);
  try {
      const collection = await initializeOrGetChromaCollection("post_embeddings");
      const queryEmbeddings = await embeddingFunction.generate(queryString);
      const searchResults = await collection.query({
          queryEmbeddings: queryEmbeddings, 
          nResults: 5
      });

      if (searchResults.error && searchResults.error == 'InvalidDimension') {
          const client = new ChromaClient();
          collection.peek()
      }
      const postIds = searchResults.ids[0];
      const postsQuery = `
          SELECT * FROM post
          WHERE post_id IN (${postIds.join(', ')});
      `;
      const relatedPosts = await db.send_sql(postsQuery);
      const sortedRelatedPosts = sortPosts(relatedPosts, postIds);
      res.json(sortedRelatedPosts);
  } catch (error) {
      console.error('Error searching for related posts:', error);
      res.status(500).json({ error: "Error retrieving related posts" });
  }
};

function sortPosts(posts, orderedIds) {
  const postMap = new Map(posts.map(post => [post.post_id.toString(), post]));
  return orderedIds.map(id => postMap.get(id));
}

// GET/checkUser
var getCheckUser = async function(req, res) {
  const { username } = req.params;
  if (!helper.isOK(username)) {
      return res.status(403).json({ error: 'Not logged in.' });
  }
  let user_id = 0;
  try {
      const getIdQuery = `SELECT user_id FROM users u WHERE u.username = '${username}';`;
      const results = await db.send_sql(getIdQuery);
      const userExist = results.length > 0;
      if (userExist) {
          res.status(200).json({ user_id: results[0].user_id });
      } else {
          res.status(200).json({ user_id: null });
      }
      
  } catch (err) {
      res.status(500).json({ error: 'Error querying database.' });
  }
};

/* Here we construct an object that contains a field for each route
 we've defined, so we can call the routes from app.js. */

var routes = { 
  get_helloworld: getHelloWorld,
  // User routes
  post_login: postLogin,
  post_logout: postLogout,
  post_register: postRegister, 
  get_face_matching: getFaceMatching,
  post_face_matching: postFaceMatching,
  get_profile: getProfile,
  update_profile: updateProfile,
  get_matched_actors: getMatchedActors,
  get_related_profiles: getRelatedProfiles,

    // Friend routes
    get_friends: getFriends,
    add_friend: addFriend,
    remove_friend: removeFriend,
    update_friend_recs: updateFriendRecs,
    get_friend_recs: getFriendRecs,
    get_followers: getFollowers,
    get_movie: getMovie,
    get_feed: getFeed,

  // Chat routes
  post_chat_group: postChatGroup,
  post_chat_profile: postUploadChatProfile,
  get_chat_groups: getChatGroups,
  get_all_users_in_chat_by_chat_id: getAllUsersInChatByChatId,
  get_all_users: getAllUsers,
  post_chat_message: postChatMessage,
  get_chat_messages: getChatMessages,
  leave_chat_delete_if_empty: leaveAndDeleteIfEmptyChatGroup,

  // Post routes
  get_comments: getComments,
  get_nested_comments: getNestedComments,
  get_post_likers: getPostLikers,
  get_post_likeCount: getPostLikeCount,
  get_post_images: getPostImages,
  get_post_hashtags: getPostHashtags,
  post_post_like: postPostLike,
  post_comment: postComment,
  post_nested_comment: postNestedComment,
  post_post: postPost,
  delete_post: deletePost,
  delete_comment: deleteComment,
  delete_nested_comment: deleteNestedComment,
  delete_post_unlike: deletePostUnlike,
  get_post_is_liked: getPostIsLiked,
  get_related_posts: getRelatedPosts,
  get_check_user: getCheckUser
};

module.exports = routes;