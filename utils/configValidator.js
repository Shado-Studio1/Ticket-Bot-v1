const fs = require('fs');
const path = require('path');

class ConfigValidator {
    static validateConfig() {
        const configPath = path.join(__dirname, '..', 'config.json');
        
        if (!fs.existsSync(configPath)) {
            throw new Error('ملف config.json غير موجود! يرجى إنشاؤه أولاً.');
        }

        let config;
        try {
            config = require(configPath);
        } catch (error) {
            throw new Error('خطأ في قراءة ملف config.json: ' + error.message);
        }

        const errors = [];

        // التحقق من الحقول المطلوبة
        const requiredFields = ['token', 'clientId', 'guildId', 'ticketCategory', 'adminRoles', 'logChannel'];
        
        for (const field of requiredFields) {
            if (!config[field]) {
                errors.push(`الحقل المطلوب "${field}" مفقود في config.json`);
            }
        }

        // التحقق من صحة التوكن
        if (config.token && (config.token === 'YOUR_BOT_TOKEN_HERE' || config.token.length < 50)) {
            errors.push('يرجى تعيين توكن البوت الصحيح في config.json');
        }

        // التحقق من صحة Client ID
        if (config.clientId && (config.clientId === 'YOUR_CLIENT_ID_HERE' || !/^\d{17,19}$/.test(config.clientId))) {
            errors.push('يرجى تعيين Client ID صحيح في config.json');
        }

        // التحقق من صحة Guild ID
        if (config.guildId && (config.guildId === 'YOUR_GUILD_ID_HERE' || !/^\d{17,19}$/.test(config.guildId))) {
            errors.push('يرجى تعيين Guild ID صحيح في config.json');
        }

        // التحقق من صحة Ticket Category ID
        if (config.ticketCategory && (config.ticketCategory === 'TICKET_CATEGORY_ID_HERE' || !/^\d{17,19}$/.test(config.ticketCategory))) {
            errors.push('يرجى تعيين ID فئة التذاكر الصحيح في config.json');
        }

        // التحقق من صحة Admin Roles
        if (config.adminRoles && Array.isArray(config.adminRoles)) {
            if (config.adminRoles.length === 0 || config.adminRoles.includes('ADMIN_ROLE_ID_1')) {
                errors.push('يرجى تعيين IDs رتب الإدارة الصحيحة في config.json');
            }
        } else {
            errors.push('adminRoles يجب أن يكون مصفوفة من IDs الرتب');
        }

        // التحقق من صحة Log Channel ID
        if (config.logChannel && (config.logChannel === 'LOG_CHANNEL_ID_HERE' || !/^\d{17,19}$/.test(config.logChannel))) {
            errors.push('يرجى تعيين ID قناة السجلات الصحيح في config.json');
        }

        // التحقق من وجود الألوان والرموز
        if (!config.colors || typeof config.colors !== 'object') {
            errors.push('إعدادات الألوان مفقودة أو غير صحيحة');
        }

        if (!config.emojis || typeof config.emojis !== 'object') {
            errors.push('إعدادات الرموز التعبيرية مفقودة أو غير صحيحة');
        }

        if (errors.length > 0) {
            console.error('❌ أخطاء في ملف الإعدادات:');
            errors.forEach(error => console.error(`   • ${error}`));
            console.error('\n📖 يرجى مراجعة ملف SETUP_GUIDE.md للحصول على تعليمات مفصلة');
            throw new Error('إعدادات غير صحيحة');
        }

        console.log('✅ تم التحقق من صحة الإعدادات بنجاح');
        return config;
    }

    static async validateBotPermissions(client) {
        try {
            const guild = client.guilds.cache.get(client.config.guildId);
            if (!guild) {
                throw new Error('لم يتم العثور على الخادم المحدد');
            }

            const botMember = guild.members.cache.get(client.user.id);
            if (!botMember) {
                throw new Error('البوت غير موجود في الخادم');
            }

            // التحقق من الصلاحيات الأساسية
            const requiredPermissions = [
                'SendMessages',
                'EmbedLinks',
                'ManageChannels',
                'ManageRoles',
                'ReadMessageHistory',
                'UseApplicationCommands'
            ];

            const missingPermissions = [];
            for (const permission of requiredPermissions) {
                if (!botMember.permissions.has(permission)) {
                    missingPermissions.push(permission);
                }
            }

            if (missingPermissions.length > 0) {
                console.warn('⚠️ صلاحيات مفقودة:', missingPermissions.join(', '));
            }

            // التحقق من وجود فئة التذاكر
            const ticketCategory = guild.channels.cache.get(client.config.ticketCategory);
            if (!ticketCategory) {
                throw new Error('فئة التذاكر المحددة غير موجودة');
            }

            if (ticketCategory.type !== 4) { // GUILD_CATEGORY
                throw new Error('ID فئة التذاكر لا يشير إلى فئة صحيحة');
            }

            // التحقق من وجود قناة السجلات
            const logChannel = guild.channels.cache.get(client.config.logChannel);
            if (!logChannel) {
                console.warn('⚠️ قناة السجلات المحددة غير موجودة');
            }

            // التحقق من وجود رتب الإدارة
            const missingRoles = [];
            for (const roleId of client.config.adminRoles) {
                const role = guild.roles.cache.get(roleId);
                if (!role) {
                    missingRoles.push(roleId);
                }
            }

            if (missingRoles.length > 0) {
                console.warn('⚠️ رتب إدارة غير موجودة:', missingRoles.join(', '));
            }

            console.log('✅ تم التحقق من صلاحيات البوت بنجاح');

        } catch (error) {
            console.error('❌ خطأ في التحقق من صلاحيات البوت:', error.message);
            throw error;
        }
    }
}

module.exports = ConfigValidator;