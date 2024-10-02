const { Bot } = require("grammy");

const bot = new Bot(
  process.env.TELEGRAM_BOT_TOKEN || "your_telegram_bot_token",
);

// Listening for messages
bot.on("message:text", (ctx) => ctx.reply("Received: " + ctx.message.text));

// Starting the bot
bot.start();
