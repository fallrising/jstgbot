require('dotenv').config();
const { Bot } = require("grammy");
const mqtt = require("mqtt");

// Load configuration from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "your_telegram_bot_token";
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://broker.emqx.io:1883";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "telegram_bot_demo/messages";
const KNOWN_TRACKING_PARAMS = new Set((process.env.KNOWN_TRACKING_PARAMS || '').split(',').filter(Boolean));
const TRACKING_WORDS = (process.env.TRACKING_WORDS || '').split(',').filter(Boolean);

const bot = new Bot(TELEGRAM_BOT_TOKEN);

// MQTT client setup
const mqttClient = mqtt.connect(MQTT_BROKER_URL);

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
});

function isLikelyTrackingParam(param) {
  return TRACKING_WORDS.some(word => param.toLowerCase().includes(word));
}

function cleanUrl(dirtyUrl) {
  const url = new URL(dirtyUrl);
  const cleanParams = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (!KNOWN_TRACKING_PARAMS.has(key) && !isLikelyTrackingParam(key)) {
      cleanParams.append(key, value);
    }
  }
  url.search = cleanParams.toString();
  return url.toString();
}

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

// Handling text messages
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  const urls = extractUrls(text);
  if (urls.length > 0) {
    const cleanedUrls = urls.map(cleanUrl);
    await ctx.reply(`Received ${cleanedUrls.length} URL(s):\n${cleanedUrls.join('\n')}`);
    cleanedUrls.forEach(url => sendToEMQX("url", url));
  } else {
    await ctx.reply("Received text: " + text);
  }
});

// Handling document messages (including bookmarks)
bot.on("message:document", async (ctx) => {
  const fileId = ctx.message.document.file_id;
  const fileName = ctx.message.document.file_name;
  
  await ctx.reply(`Received file: ${fileName}`);
  
  // Get file info
  const file = await ctx.api.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
  
  sendToEMQX("file", { fileName, fileUrl });
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
