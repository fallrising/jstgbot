const { Bot } = require("grammy");
const mqtt = require("mqtt");

const bot = new Bot(
  process.env.TELEGRAM_BOT_TOKEN || "your_telegram_bot_token"
);

// MQTT client setup using public EMQX broker
const mqttClient = mqtt.connect("mqtt://broker.emqx.io:1883");

mqttClient.on("connect", () => {
  console.log("Connected to public EMQX broker");
});

// Extended list of known tracking parameters
const knownTrackingParams = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', '_ga', 'ref', 'source', 'spm', 'pvid', 'yclid',
  'mktg_source', 'mktg_medium', 'mktg_campaign', 'itm_source', 'itm_medium',
  'itm_campaign', 'adid', 'adtype', 'adpos', 'adgroup', 'ad_campaign'
]);

function isLikelyTrackingParam(param) {
  // Check if the param contains words often used in tracking
  const trackingWords = ['track', 'clk', 'click', 'ref', 'ad', 'src', 'source', 'medium', 'campaign'];
  return trackingWords.some(word => param.toLowerCase().includes(word));
}

function cleanUrl(dirtyUrl) {
  const url = new URL(dirtyUrl);
  const cleanParams = new URLSearchParams();

  for (const [key, value] of url.searchParams.entries()) {
    if (!knownTrackingParams.has(key) && !isLikelyTrackingParam(key)) {
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
    sendToEMQX("text", text);
  }
});

// Handling document messages (including bookmarks)
bot.on("message:document", async (ctx) => {
  const fileId = ctx.message.document.file_id;
  const fileName = ctx.message.document.file_name;
  
  await ctx.reply(`Received file: ${fileName}`);
  
  // Get file info
  const file = await ctx.api.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
  
  sendToEMQX("file", { fileName, fileUrl });
});

function sendToEMQX(type, content) {
  const topic = "telegram_bot_demo/messages";
  const message = JSON.stringify({ type, content });
  mqttClient.publish(topic, message, (err) => {
    if (err) {
      console.error("Error publishing to EMQX:", err);
    } else {
      console.log(`Message sent to EMQX on topic: ${topic}`);
    }
  });
}

// Starting the bot
bot.start();
