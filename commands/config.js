const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../utils/ticketUtils');
const config = require('../config.json');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('عرض أو تحديث إعدادات البوت')
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('عرض الإعدادات الحالية'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-category')
                .setDescription('تحديد فئة التذاكر')
                .addChannelOption(option =>
                    option.setName('category')
                        .setDescription('فئة التذاكر الجديدة')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-log-channel')
                .setDescription('تحديد قناة السجلات')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('قناة السجلات الجديدة')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add-admin-role')
                .setDescription('إضافة رتبة إدارية')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('الرتبة الإدارية الجديدة')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove-admin-role')
                .setDescription('إزالة رتبة إدارية')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('الرتبة الإدارية المراد إزالتها')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        try {
            const member = interaction.member;
            const subcommand = interaction.options.getSubcommand();

            // التحقق من صلاحيات الإدارة
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`${config.emojis.error} غير مسموح`)
                    .setDescription('هذا الأمر مخصص لمدراء الخادم فقط!')
                    .setColor(config.colors.error);

                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            switch (subcommand) {
                case 'show':
                    await showConfig(interaction);
                    break;
                case 'set-category':
                    await setCategory(interaction);
                    break;
                case 'set-log-channel':
                    await setLogChannel(interaction);
                    break;
                case 'add-admin-role':
                    await addAdminRole(interaction);
                    break;
                case 'remove-admin-role':
                    await removeAdminRole(interaction);
                    break;
            }

        } catch (error) {
            console.error('خطأ في إدارة الإعدادات:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.error} خطأ في الإعدادات`)
                .setDescription('حدث خطأ أثناء تحديث الإعدادات.')
                .setColor(config.colors.error);

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
};

async function showConfig(interaction) {
    const guild = interaction.guild;
    
    // معلومات فئة التذاكر
    const ticketCategory = guild.channels.cache.get(config.ticketCategory);
    const categoryInfo = ticketCategory ? `${ticketCategory.name} (${ticketCategory.id})` : 'غير موجودة ❌';
    
    // معلومات قناة السجلات
    const logChannel = guild.channels.cache.get(config.logChannel);
    const logChannelInfo = logChannel ? `${logChannel.name} (${logChannel.id})` : 'غير موجودة ❌';
    
    // معلومات رتب الإدارة
    const adminRolesInfo = config.adminRoles.map(roleId => {
        const role = guild.roles.cache.get(roleId);
        return role ? `• ${role.name} (${role.id})` : `• رتبة غير موجودة (${roleId}) ❌`;
    }).join('\n') || 'لا توجد رتب محددة';

    const configEmbed = new EmbedBuilder()
        .setTitle(`${config.emojis.ticket} إعدادات البوت الحالية`)
        .setDescription(`
**🏷️ معلومات البوت:**
• اسم البوت: ${interaction.client.user.tag}
• ID البوت: ${interaction.client.user.id}
• الخادم: ${guild.name}
• ID الخادم: ${guild.id}

**📁 فئة التذاكر:**
${categoryInfo}

**📋 قناة السجلات:**
${logChannelInfo}

**🛡️ رتب الإدارة:**
${adminRolesInfo}

**🎨 إعدادات التصميم:**
• اللون الأساسي: ${config.colors.primary}
• لون النجاح: ${config.colors.success}
• لون الخطأ: ${config.colors.error}
        `)
        .setColor(config.colors.info)
        .setThumbnail(guild.iconURL())
        .setFooter({ text: 'استخدم الأوامر الفرعية لتحديث الإعدادات' })
        .setTimestamp();

    await interaction.reply({ embeds: [configEmbed] });
}

async function setCategory(interaction) {
    const category = interaction.options.getChannel('category');
    
    if (category.type !== 4) { // GUILD_CATEGORY
        const errorEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.error} نوع قناة خاطئ`)
            .setDescription('يجب اختيار فئة وليس قناة عادية!')
            .setColor(config.colors.error);

        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // تحديث الإعدادات
    const configPath = path.join(__dirname, '..', 'config.json');
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    currentConfig.ticketCategory = category.id;
    
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
    
    // تحديث الإعدادات في الذاكرة
    config.ticketCategory = category.id;

    const successEmbed = new EmbedBuilder()
        .setTitle(`${config.emojis.success} تم تحديث فئة التذاكر`)
        .setDescription(`تم تعيين فئة التذاكر إلى: **${category.name}**`)
        .setColor(config.colors.success);

    await interaction.reply({ embeds: [successEmbed] });
}

async function setLogChannel(interaction) {
    const channel = interaction.options.getChannel('channel');
    
    if (channel.type !== 0) { // GUILD_TEXT
        const errorEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.error} نوع قناة خاطئ`)
            .setDescription('يجب اختيار قناة نصية!')
            .setColor(config.colors.error);

        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // تحديث الإعدادات
    const configPath = path.join(__dirname, '..', 'config.json');
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    currentConfig.logChannel = channel.id;
    
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
    
    // تحديث الإعدادات في الذاكرة
    config.logChannel = channel.id;

    const successEmbed = new EmbedBuilder()
        .setTitle(`${config.emojis.success} تم تحديث قناة السجلات`)
        .setDescription(`تم تعيين قناة السجلات إلى: ${channel}`)
        .setColor(config.colors.success);

    await interaction.reply({ embeds: [successEmbed] });
}

async function addAdminRole(interaction) {
    const role = interaction.options.getRole('role');
    
    if (config.adminRoles.includes(role.id)) {
        const errorEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.error} رتبة موجودة بالفعل`)
            .setDescription(`الرتبة **${role.name}** موجودة بالفعل في قائمة رتب الإدارة!`)
            .setColor(config.colors.error);

        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // تحديث الإعدادات
    const configPath = path.join(__dirname, '..', 'config.json');
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    currentConfig.adminRoles.push(role.id);
    
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
    
    // تحديث الإعدادات في الذاكرة
    config.adminRoles.push(role.id);

    const successEmbed = new EmbedBuilder()
        .setTitle(`${config.emojis.success} تم إضافة رتبة إدارية`)
        .setDescription(`تم إضافة الرتبة **${role.name}** إلى قائمة رتب الإدارة!`)
        .setColor(config.colors.success);

    await interaction.reply({ embeds: [successEmbed] });
}

async function removeAdminRole(interaction) {
    const role = interaction.options.getRole('role');
    
    if (!config.adminRoles.includes(role.id)) {
        const errorEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.error} رتبة غير موجودة`)
            .setDescription(`الرتبة **${role.name}** غير موجودة في قائمة رتب الإدارة!`)
            .setColor(config.colors.error);

        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // تحديث الإعدادات
    const configPath = path.join(__dirname, '..', 'config.json');
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    currentConfig.adminRoles = currentConfig.adminRoles.filter(roleId => roleId !== role.id);
    
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
    
    // تحديث الإعدادات في الذاكرة
    config.adminRoles = config.adminRoles.filter(roleId => roleId !== role.id);

    const successEmbed = new EmbedBuilder()
        .setTitle(`${config.emojis.success} تم إزالة رتبة إدارية`)
        .setDescription(`تم إزالة الرتبة **${role.name}** من قائمة رتب الإدارة!`)
        .setColor(config.colors.success);

    await interaction.reply({ embeds: [successEmbed] });
}