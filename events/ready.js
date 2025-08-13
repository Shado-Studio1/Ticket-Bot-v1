const { Events, ActivityType } = require('discord.js');
const ConfigValidator = require('../utils/configValidator');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`✅ تم تسجيل الدخول بنجاح باسم ${client.user.tag}`);
        console.log(`🎟️ بوت التذاكر الاحترافي جاهز للعمل!`);
        console.log(`📊 متصل بـ ${client.guilds.cache.size} خادم`);
        
        // التحقق من صلاحيات البوت
        try {
            await ConfigValidator.validateBotPermissions(client);
        } catch (error) {
            console.error('⚠️ تحذير: مشكلة في الصلاحيات:', error.message);
        }
        
        // تعيين حالة البوت
        client.user.setActivity('🎟️ نظام التذاكر الاحترافي', { 
            type: ActivityType.Watching 
        });
        
        // تسجيل الأوامر
        console.log(`📝 تم تحميل ${client.commands.size} أمر`);
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎟️  بوت التذاكر الاحترافي جاهز!  🎟️');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    },
};