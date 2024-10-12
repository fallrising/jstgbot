require('dotenv').config();
const { Bot } = require("grammy");
const mqtt = require("mqtt");
const { v4: uuidv4 } = require('uuid');

// Load configuration from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "your_telegram_bot_token";
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://broker.emqx.io:1883";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "telegram_bot_demo/messages";

// Generate a UUID to replace the token in URLs
const TOKEN_UUID = uuidv4();

const bot = new Bot(TELEGRAM_BOT_TOKEN);

// MQTT client setup
const mqttClient = mqtt.connect(MQTT_BROKER_URL);

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
});

// Handling document messages (including all file types)
bot.on("message:document", async (ctx) => {
  const doc = ctx.message.document;
  const fileId = doc.file_id;
  const fileName = doc.file_name;
  const mimeType = doc.mime_type;

  await ctx.reply(`Received file of type ${mimeType}: ${fileName}`);

  // Get file info
  const file = await ctx.api.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${TOKEN_UUID}/${file.file_path}`;

  sendToEMQX(mimeType, { fileName, fileUrl });
});

// Handling image messages
bot.on("message:photo", async (ctx) => {
  const photoInfo = ctx.message.photo.pop(); // Get the highest quality photo
  const fileId = photoInfo.file_id;

  await ctx.reply("Received an image");

  // Get file info
  const file = await ctx.api.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${TOKEN_UUID}/${file.file_path}`;

  sendToEMQX("image/jpeg", { fileUrl });
});

// Handling video messages
bot.on("message:video", async (ctx) => {
  const fileId = ctx.message.video.file_id;
  const fileName = ctx.message.video.file_name || "video.mp4";
  const mimeType = ctx.message.video.mime_type || "video/mp4";

  await ctx.reply(`Received a video: ${fileName}`);

  // Get file info
  const file = await ctx.api.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${TOKEN_UUID}/${file.file_path}`;

  sendToEMQX(mimeType, { fileName, fileUrl });
});

function sendToEMQX(type, content) {
  const message = JSON.stringify({ type, content });
  mqttClient.publish(MQTT_TOPIC, message, (err) => {
    if (err) {
      console.error("Error publishing to MQTT:", err);
    } else {
      console.log(`Message sent to MQTT on topic: ${MQTT_TOPIC}`);
    }
  });
}

// Starting the bot
bot.start();

console.log(`Using TOKEN_UUID: ${TOKEN_UUID}`);