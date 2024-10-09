const bcrypt = require('bcrypt'); 
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3'); 
const { fromIni } = require("@aws-sdk/credential-provider-ini");

const credentials = fromIni({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN
});

const s3 = new S3Client({ region: 'us-east-1', credentials: credentials});

const uploadProfilePicToS3Helper = async (username, file) => {
    var fs = require('fs');
    // var fileStream = fs.createReadStream('./query.jpg'); // For local testing purposes
    const fileStream = fs.createReadStream(file.path);

    const params = {
        Bucket: "imdb-embeddings-upenn-nets2120-2024sp-cloudyssey",
        Key: `${username}.jpg`,
        Body: fileStream
    };

    try {
        const command = new PutObjectCommand(params);
        const data = await s3.send(command);
        console.log("Upload successful, data returned:", data);
        return `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`; // TODO: avoid manually construct?
    } catch (err) {
        console.error('Error uploading to S3:', err);
        throw err;
    }
};

const uploadActorPicToS3Helper = async (username, file, actor_id) => {
    var fs = require('fs');
    var fileStream = fs.createReadStream(file);

    const params = {
        Bucket: "imdb-embeddings-upenn-nets2120-2024sp-cloudyssey",
        Key: `${username}_${actor_id}.jpg`,
        Body: fileStream
    };

    try {
        const command = new PutObjectCommand(params);
        const data = await s3.send(command);
        console.log("Upload successful, data returned:", data);
        return `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`; // TODO: avoid manually construct?
    } catch (err) {
        console.error('Error uploading to S3:', err);
        throw err;
    }
};

const getActorsPicFromS3Helper = async (username) => {
    const params = {
        Bucket: "imdb-embeddings-upenn-nets2120-2024sp-cloudyssey",
        Prefix: `${username}_nm` 
    };

    try {
        const command = new ListObjectsV2Command(params);
        const data = await s3.send(command);
        const images = data.Contents.map(item => {
            const temp = item.Key.split('_')[1];
            const actor_nconst = temp.split('.')[0];
            return {
                actor_nconst: actor_nconst,
                image_url: `https://imdb-embeddings-upenn-nets2120-2024sp-cloudyssey.s3.amazonaws.com/${item.Key}`
            };
        });
        return images;
    } catch (err) {
        console.error('Error fetching from S3:', err);
        throw err;
    }
};

const uploadFeedPicToS3Helper = async (username, file) => {
    var fs = require('fs');
    // var fileStream = fs.createReadStream('./query.jpg'); // For local testing purposes
    const fileStream = fs.createReadStream(file.path);

    const params = {
        Bucket: "imdb-embeddings-upenn-nets2120-2024sp-cloudyssey",
        Key: `${username}.jpg`,
        Body: fileStream
    };

    try {
        const command = new PutObjectCommand(params);
        const data = await s3.send(command);
        console.log("Upload successful, data returned:", data);
        return `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`; // TODO: avoid manually construct?
    } catch (err) {
        console.error('Error uploading to S3:', err);
        throw err;
    }
};

const uploadChatProfilePicToS3Helper = async (chatId, file) => {
  var fs = require('fs');
  const fileStream = fs.createReadStream(file.path);

  const params = {
      Bucket: "imdb-embeddings-upenn-nets2120-2024sp-cloudyssey", 
      Key: `chat-profiles/${chatId}/${file.originalname}`, 
      Body: fileStream
  };

  try {
      const command = new PutObjectCommand(params);
      const data = await s3.send(command);
      console.log("Upload successful, data returned:", data);
      return `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`;
  } catch (err) {
      console.error('Error uploading to S3:', err);
      throw err;
  }
};


var route_helper = function() {
    return {

        // Function for encrypting passwords WITH SALT
        // Look at the bcrypt hashing routines
        encryptPassword: (password, callback) => {
            const saltRounds = 10;
            bcrypt.hash(password, saltRounds, callback);
        },

        // Function that validates the user is actually logged in,
        // which should only be possible if they've been authenticated
        // It can look at either an ID (as an int) or a username (as a string)
        isLoggedIn: (req, obj) => {
            if (typeof obj === 'string' || obj instanceof String)
                return req.session.username != null && req.session.username == obj;
            else
                return req.session.user_id != null && req.session.user_id == obj;
        },

        // Checks that every character is a space, letter, number, or one of the following: .,?,_
        isOK: (str) => {
            if (str == null)
                return false;
            for (var i = 0; i < str.length; i++) {
                if (!/[A-Za-z0-9 \.\?,_]/.test(str[i])) {
                    return false;
                }
            }
            return true;
        },

        checkPassword: (password, hash, callback) => {
            return bcrypt.compare(password, hash, callback);
        },

        // Upload user's profile pic to S3 and convert it into a URL
        uploadProfilePicToS3: async (username, file) => {
            try {
                return await uploadProfilePicToS3Helper(username, file);
            } catch (err) {
                console.error("Error uploading profile picture to S3: ", err);
                throw err;
            }
        },

        // Upload input actor' pic to S3 and convert it into a URL
        uploadActorPicToS3: async (username, file, actor_id) => {
            try {
                return await uploadActorPicToS3Helper(username, file, actor_id);
            } catch (err) {
                console.error("Error uploading actors picture to S3: ", err);
                throw err;
            }
        },

        // Get 5 actors' pic from S3 and return their nconsts and URLs
        getActorsPicFromS3: async (username) => {
            try {
                return await getActorsPicFromS3Helper(username);
            } catch (err) {
                console.error("Error getting actors picture from S3: ", err);
                throw err;
            }
        },

        uploadChatProfilePicToS3: async (chatId, file) => {
            try {
                return await uploadChatProfilePicToS3Helper(chatId, file);
            } catch (err) {
                console.error("Error uploading chat profile picture to S3: ", err);
                throw err;
            }
        },

        uploadFeedPicToS3: async (username, file) => {
            try {
                return await uploadFeedPicToS3Helper(username, file);
            } catch (err) {
                console.error("Error uploading feed picture to S3: ", err);
                throw err;
            }
        },
    };
};

var encryptPassword = function(password, callback) {
    return route_helper().encryptPassword(password, callback);
}

var isOK = function(req) {
    return route_helper().isOK(req);
}

var isLoggedIn = function(req, obj) {
    return route_helper().isLoggedIn(req, obj);
}

var checkPassword = function(password, hash, callback) {
    return route_helper().checkPassword(password, hash, callback);
}

var uploadProfilePicToS3 = function(username, file) {
    return route_helper().uploadProfilePicToS3(username, file);
}

var uploadActorPicToS3 = function(username, file, actor_id) {
    return route_helper().uploadActorPicToS3(username, file, actor_id);
}

var getActorsPicFromS3 = function(username) {
    return route_helper().getActorsPicFromS3(username);
}

var uploadFeedPicToS3 = function(username, file) {
    return route_helper().uploadProfilePicToS3(username, file);
}

var uploadChatProfilePicToS3 = function(chatId, file) {
    return route_helper().uploadChatProfilePicToS3(chatId, file);
}

module.exports = {
    isOK,
    isLoggedIn,
    encryptPassword,
    checkPassword,
    uploadProfilePicToS3,
    uploadActorPicToS3,
    getActorsPicFromS3,
    uploadFeedPicToS3,
    uploadChatProfilePicToS3
};

