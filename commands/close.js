const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadTicketsData, saveTicketsData, isAdmin, createCloseReport } = require('../utils/ticketUtils');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('إغلاق التذكرة الحالية')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('سبب إغلاق التذكرة')
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            const member = interaction.member;
            const channel = interaction.channel;
            const guild = interaction.guild;
            const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';

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

            if (ticketData.status === 'closed') {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`${config.emojis.error} تذكرة مغلقة بالفعل`)
                    .setDescription('هذه التذكرة مغلقة بالفعل!')
                    .setColor(config.colors.error);

                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // إنشاء تقرير الإغلاق
            const closeReport = createCloseReport(ticketData, member, guild);
            closeReport.addFields({
                name: '📝 سبب الإغلاق',
                value: reason,
                inline: false
            });

            // إرسال التقرير للمستخدم
            const user = guild.members.cache.get(ticketData.userId);
            if (user) {
                try {
                    await user.send({ embeds: [closeReport] });
                } catch (error) {
                    console.log('لا يمكن إرسال رسالة خاصة للمستخدم');
                }
            }

            // إرسال التقرير لقناة السجلات
            if (config.logChannel) {
                const logChannel = guild.channels.cache.get(config.logChannel);
                if (logChannel) {
                    await logChannel.send({ embeds: [closeReport] });
                }
            }

            // تحديث حالة التذكرة
            data.tickets[channel.id].status = 'closed';
            data.tickets[channel.id].closedBy = member.id;
            data.tickets[channel.id].closedAt = new Date().toISOString();
            data.tickets[channel.id].closeReason = reason;
            saveTicketsData(data);

            // إرسال رسالة الإغلاق
            const closingEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.close} جاري إغلاق التذكرة`)
                .setDescription(`**السبب:** ${reason}\n\nسيتم حذف هذه القناة خلال 10 ثوانٍ...`)
                .setColor(config.colors.error)
                .setFooter({ text: `تم الإغلاق بواسطة ${member.displayName}` })
                .setTimestamp();

            await interaction.reply({ embeds: [closingEmbed] });

            // حذف القناة بعد 10 ثوانٍ
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (error) {
                    console.error('خطأ في حذف القناة:', error);
                }
            }, 10000);

        } catch (error) {
            console.error('خطأ في إغلاق التذكرة:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.error} خطأ في الإغلاق`)
                .setDescription('حدث خطأ أثناء إغلاق التذكرة.')
                .setColor(config.colors.error);

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};