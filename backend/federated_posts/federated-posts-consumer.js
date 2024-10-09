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
        const source_site = parsedMessage.source_site;
        if (source_site != "g29") {
            const content = escapeSqlString(parsedMessage.post_text);
            let photo = null;
            if (message.value.attach) {
                photo = message.value.attach;
            }

            const user_id = 64;
            const username = "Federated%20Post";
    
            const formData = new FormData();
            formData.append('content', content);
            formData.append('user_id', user_id);
            if (photo) {
                formData.append('photo', photo);
            }
    
            await axios.post(`${config.serverRootURL}/${username}/post`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
    
            console.log('Message processed successfully');
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
};

const consumeMessages = async () => {
    await consumer.connect();
    console.log(`Following topic ${config["federated-post-topic"]}`);
    await consumer.subscribe({ topic: config["federated-post-topic"], fromBeginning: true });
    console.log("Successfully subscribed");
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            console.log(message);
            await processMessage(message);
        },
    });
};

const fstartConsumer = async () => {
    try {
        console.log("Entered StartConsumer");
        await consumeMessages();
    } catch (error) {
        console.error('Error starting consumer:', error);
    }
};

module.exports = {
    fstartConsumer
};
