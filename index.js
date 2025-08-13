const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ConfigValidator = require('./utils/configValidator');

// التحقق من صحة الإعدادات قبل البدء
let config;
try {
    config = ConfigValidator.validateConfig();
} catch (error) {
    console.error('فشل في بدء البوت:', error.message);
    process.exit(1);
}

// إنشاء العميل
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// مجموعة الأوامر
client.commands = new Collection();
client.tickets = new Map(); // لتخزين بيانات التذاكر
client.config = config; // إتاحة الإعدادات للبوت

// تحميل الأوامر
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[تحذير] الأمر في ${filePath} مفقود خاصية "data" أو "execute" المطلوبة.`);
        }
    }
}

// تحميل الأحداث
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
}

// تسجيل الدخول
client.login(config.token).catch(console.error);

// معالجة الأخطاء
process.on('unhandledRejection', error => {
    console.error('خطأ غير معالج:', error);
});

process.on('uncaughtException', error => {
    console.error('استثناء غير معالج:', error);
    process.exit(1);
});

module.exports = client;