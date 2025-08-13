const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadTicketsData, isAdmin } = require('../utils/ticketUtils');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('إزالة مستخدم من التذكرة')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('المستخدم المراد إزالته')
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

            // التحقق من أن المستخدم ليس صاحب التذكرة
            if (targetUser.id === ticketData.userId) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`${config.emojis.error} لا يمكن الإزالة`)
                    .setDescription('لا يمكن إزالة صاحب التذكرة!')
                    .setColor(config.colors.error);

                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // التحقق من أن المستخدم ليس من الإدارة
            if (targetMember && isAdmin(targetMember)) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`${config.emojis.error} لا يمكن الإزالة`)
                    .setDescription('لا يمكن إزالة أعضاء الإدارة من التذكرة!')
                    .setColor(config.colors.error);

                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // إزالة صلاحيات المستخدم
            await channel.permissionOverwrites.delete(targetUser.id);

            // إرسال رسالة تأكيد
            const successEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.success} تم إزالة المستخدم`)
                .setDescription(`تم إزالة ${targetMember || targetUser.tag} من هذه التذكرة بنجاح!`)
                .setColor(config.colors.success)
                .setTimestamp();

            await interaction.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('خطأ في إزالة المستخدم:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.error} خطأ في الإزالة`)
                .setDescription('حدث خطأ أثناء إزالة المستخدم من التذكرة.')
                .setColor(config.colors.error);

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};