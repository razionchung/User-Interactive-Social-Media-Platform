const express = require('express');
const { Kafka, CompressionTypes, CompressionCodecs } = require('kafkajs');
const config = require('../config.json');
const axios = require('axios');
const FormData = require('form-data');
const app = express();
const SnappyCodec = require('kafkajs-snappy');
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;

const kafka = new Kafka({
    clientId: 'my-app',
    brokers: config.bootstrapServers
});

const consumer = kafka.consumer({
    groupId: config.groupId,
    bootstrapServers: config.bootstrapServers
});

var kafka_messages = [];

app.get('/', (req, res) => {
    res.send(JSON.stringify(kafka_messages));
});

function escapeSqlString(text) {
    return text.replace(/'/g, "''");
}

const processMessage = async (message) => {
    try {
        const messageValue = message.value.toString();
        const parsedMessage = JSON.parse(messageValue);
        const content = escapeSqlString(parsedMessage.text);
        const hashtags = parsedMessage.hashtags;
        const formattedHashtags = hashtags.join(', ');
        const user_id = 65;
        const username = "Twitter";
  
        const formData = new FormData();
        formData.append('content', content);
        formData.append('hashtags', formattedHashtags);
        formData.append('user_id', user_id);
  
        await axios.post(`${config.serverRootURL}/${username}/post`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
  
        console.log('Message processed successfully');
    } catch (error) {
        console.error('Error processing message:', error);
    }
};

const consumeMessages = async () => {
    await consumer.connect();
    console.log(`Following topic ${config["twitter-topic"]}`);
    await consumer.subscribe({ topic: config["twitter-topic"], fromBeginning: true });
    console.log("Successfully subscribed");
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            console.log(message);
            await processMessage(message);
        },
    });
};

const startConsumer = async () => {
    try {
        console.log("Entered StartConsumer");
        await consumeMessages();
    } catch (error) {
        console.error('Error starting consumer:', error);
    }
};

module.exports = {
    startConsumer
};
