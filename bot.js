require('dotenv').config();
const { Bot } = require("grammy");
const mqtt = require("mqtt");
const { v4: uuidv4 } = require('uuid');

// Load configuration from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "your_telegram_bot_token";
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://broker.emqx.io:1883";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "telegram_bot_demo/messages";
const KNOWN_TRACKING_PARAMS = new Set((process.env.KNOWN_TRACKING_PARAMS || '').split(',').filter(Boolean));
const TRACKING_WORDS = (process.env.TRACKING_WORDS || '').split(',').filter(Boolean);

// get last 4 digits of the token
const lastFourDigits = TELEGRAM_BOT_TOKEN.slice(-4);

// Generate a UUID to replace the token in URLs
const TOKEN_UUID = uuidv4() + lastFourDigits;

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
  // Break down the pattern into parts
  const protocols = '(?:https?:\\/\\/)?';  // Optional http:// or https://
  const www = '(?:www\\.)?';               // Optional www.
  const domainName = '(?:[a-z0-9-]+\\.)+'; // One or more subdomain parts
  const tld = '[a-z]{2,}';                 // Top-level domain (.com, .org, etc)
  const path = '(?:\\/[^\\s]*)?';          // Optional path after domain

  // Combine the parts
  const urlPattern = new RegExp(
      '\\b' +                // Word boundary
      protocols +           // http://, https://, or nothing
      www +                 // www. or nothing
      domainName +          // domain parts (e.g., google., maps.google.)
      tld +                 // Top-level domain
      path,                 // Optional path
      'gi'                  // Global, case-insensitive
  );

  // Extract URLs and process them
  const matches = text.match(urlPattern) || [];

  // Add missing protocols
  return matches.map(url => {
    // If URL doesn't start with a protocol, add https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Add www. if it's not present
      const withWww = url.startsWith('www.') ? url : 'www.' + url;
      return 'https://' + withWww;
    }
    return url;
  });
}

// Handling text messages
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  const urls = extractUrls(text);
  if (urls.length > 0) {
    const cleanedUrls = urls.map(cleanUrl);
    await ctx.reply(`Received ${cleanedUrls.length} URL(s):\n${cleanedUrls.join('\n')}`);
    sendToEMQX("url", cleanedUrls);
  } else {
    await ctx.reply("Received text: " + text);
  }
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

  sendToEMQX("file", { fileType: mimeType, fileUrl, fileName });
});

// Handling image messages
bot.on("message:photo", async (ctx) => {
  const photoInfo = ctx.message.photo.pop(); // Get the highest quality photo
  const fileId = photoInfo.file_id;

  await ctx.reply("Received an image");

  // Get file info
  const file = await ctx.api.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${TOKEN_UUID}/${file.file_path}`;

  sendToEMQX("file", { fileType: "image/jpeg", fileUrl, fileName: "image.jpg" });
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

  sendToEMQX("file", { fileType: mimeType, fileUrl, fileName });
});

function sendToEMQX(type, content) {
  let message;
  if (type === "url") {
    message = {
      messageType: "url",
      urls: content
    };
  } else if (type === "file") {
    message = {
      messageType: "file",
      ...content
    };
  }
  mqttClient.publish(MQTT_TOPIC, JSON.stringify(message), (err) => {
    if (err) {
      console.error("Error publishing to MQTT:", err);
    } else {
      console.log(`Message sent to MQTT on topic: ${MQTT_TOPIC}`);
    }
  });
}

// Starting the bot
bot.start().then(r => {
  console.log("Bot is running");
});

console.log(`Using TOKEN_UUID: ${TOKEN_UUID}`);