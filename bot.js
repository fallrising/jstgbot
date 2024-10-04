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

// Handling text messages
bot.on("message:text", async (ctx) => {
  await ctx.reply("Received text: " + ctx.message.text);
  sendToEMQX("text", ctx.message.text);
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
  const topic = "jsstg_demo/messages";
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
