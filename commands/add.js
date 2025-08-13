const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { loadTicketsData, isAdmin } = require('../utils/ticketUtils');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('إضافة مستخدم إلى التذكرة')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('المستخدم المراد إضافته')
                .setRequired(true)),
    
    async execute(interaction) {
        try {
            const member = interaction.member;
            const channel = interaction.channel;
            const targetUser = interaction.options.getUser('user');
            const targetMember = interaction.guild.members.cache.get(targetUser.id);

            // التحقق من صلاحيات الإدارة
            if (!isAdmin(member)) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`${config.emojis.error} غير مسموح`)
                    .setDescription('هذا الأمر مخصص للإدارة فقط!')
                    .setColor(config.colors.error);

                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // التحقق من أن هذه قناة تذكرة
            const data = loadTicketsData();
            const ticketData = data.tickets[channel.id];

            if (!ticketData) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`${config.emojis.error} ليست قناة تذكرة`)
                    .setDescription('هذا الأمر يعمل فقط في قنوات التذاكر!')
                    .setColor(config.colors.error);

                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (!targetMember) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`${config.emojis.error} مستخدم غير موجود`)
                    .setDescription('لم يتم العثور على هذا المستخدم في الخادم!')
                    .setColor(config.colors.error);

                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // إضافة صلاحيات للمستخدم
            await channel.permissionOverwrites.edit(targetUser.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true
            });

            // إرسال رسالة تأكيد
            const successEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.success} تم إضافة المستخدم`)
                .setDescription(`تم إضافة ${targetMember} إلى هذه التذكرة بنجاح!`)
                .setColor(config.colors.success)
                .setTimestamp();

            await interaction.reply({ embeds: [successEmbed] });

            // إشعار المستخدم المضاف
            const notificationEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.ticket} تم إضافتك إلى تذكرة`)
                .setDescription(`تم إضافتك إلى التذكرة #${ticketData.ticketNumber} بواسطة ${member}`)
                .setColor(config.colors.info);

            await channel.send({
                content: `${targetMember}`,
                embeds: [notificationEmbed]
            });

        } catch (error) {
            console.error('خطأ في إضافة المستخدم:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.error} خطأ في الإضافة`)
                .setDescription('حدث خطأ أثناء إضافة المستخدم إلى التذكرة.')
                .setColor(config.colors.error);

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};