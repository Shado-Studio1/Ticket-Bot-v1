const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { loadTicketsData, isAdmin } = require('../utils/ticketUtils');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('عرض إحصائيات التذاكر')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        try {
            const member = interaction.member;

            // التحقق من صلاحيات الإدارة
            if (!isAdmin(member)) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`${config.emojis.error} غير مسموح`)
                    .setDescription('هذا الأمر مخصص للإدارة فقط!')
                    .setColor(config.colors.error);

                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // تحميل بيانات التذاكر
            const data = loadTicketsData();
            const tickets = Object.values(data.tickets);

            // حساب الإحصائيات
            const totalTickets = tickets.length;
            const openTickets = tickets.filter(ticket => ticket.status === 'open').length;
            const closedTickets = tickets.filter(ticket => ticket.status === 'closed').length;
            const claimedTickets = tickets.filter(ticket => ticket.claimedBy).length;

            // تصنيف التذاكر حسب النوع
            const ticketTypes = {
                support: tickets.filter(ticket => ticket.ticketType === 'support').length,
                complaint: tickets.filter(ticket => ticket.ticketType === 'complaint').length,
                report: tickets.filter(ticket => ticket.ticketType === 'report').length,
                prize: tickets.filter(ticket => ticket.ticketType === 'prize').length
            };

            // إنشاء embed الإحصائيات
            const statsEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.ticket} إحصائيات نظام التذاكر`)
                .setDescription(`
**📊 الإحصائيات العامة:**
• إجمالي التذاكر: **${totalTickets}**
• التذاكر المفتوحة: **${openTickets}** 🟢
• التذاكر المغلقة: **${closedTickets}** 🔴
• التذاكر المستلمة: **${claimedTickets}** ✋

**📋 التذاكر حسب النوع:**
• ${config.emojis.support} دعم فني: **${ticketTypes.support}**
• ${config.emojis.complaint} شكاوى: **${ticketTypes.complaint}**
• ${config.emojis.report} إبلاغات: **${ticketTypes.report}**
• ${config.emojis.prize} جوائز: **${ticketTypes.prize}**

**🔢 رقم التذكرة التالي:** #${data.nextTicketNumber.toString().padStart(4, '0')}
                `)
                .setColor(config.colors.info)
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: 'نظام التذاكر الاحترافي' })
                .setTimestamp();

            // عرض التذاكر المفتوحة حالياً
            if (openTickets > 0) {
                const openTicketsList = tickets
                    .filter(ticket => ticket.status === 'open')
                    .slice(0, 10) // عرض أول 10 تذاكر فقط
                    .map(ticket => {
                        const user = interaction.guild.members.cache.get(ticket.userId);
                        const claimer = ticket.claimedBy ? interaction.guild.members.cache.get(ticket.claimedBy) : null;
                        const typeEmojis = {
                            'support': config.emojis.support,
                            'complaint': config.emojis.complaint,
                            'report': config.emojis.report,
                            'prize': config.emojis.prize
                        };
                        
                        return `• #${ticket.ticketNumber} ${typeEmojis[ticket.ticketType]} - ${user ? user.displayName : 'مستخدم غير معروف'}${claimer ? ` (${claimer.displayName})` : ''}`;
                    })
                    .join('\n');

                statsEmbed.addFields({
                    name: '🟢 التذاكر المفتوحة حالياً',
                    value: openTicketsList || 'لا توجد تذاكر مفتوحة',
                    inline: false
                });
            }

            await interaction.reply({ embeds: [statsEmbed] });

        } catch (error) {
            console.error('خطأ في عرض إحصائيات التذاكر:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.error} خطأ في الإحصائيات`)
                .setDescription('حدث خطأ أثناء تحميل إحصائيات التذاكر.')
                .setColor(config.colors.error);

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};