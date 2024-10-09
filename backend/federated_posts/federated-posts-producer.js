const { Kafka, CompressionTypes, CompressionCodecs } = require('kafkajs');
const config = require('../config.json');
const SnappyCodec = require('kafkajs-snappy');
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: config.bootstrapServers
});

const producer = kafka.producer();

async function sendMessage(message, attachment) {
  await producer.connect();
  await producer.send({
    topic: config["federated-post-topic"],
    messages: [
      {
        value: JSON.stringify(message),
        headers: {
          'content-type': message.content_type,
        },
        ...(attachment && { attachment: attachment }),
      },
    ],
  });
  console.log("Successfully send message to Federated Posts");
  await producer.disconnect();
}

module.exports = {
  sendMessage,
};
