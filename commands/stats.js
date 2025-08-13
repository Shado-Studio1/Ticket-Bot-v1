const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { loadTicketsData, isAdmin, calculateTicketDuration } = require('../utils/ticketUtils');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('عرض إحصائيات مفصلة للتذاكر')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('عرض إحصائيات مستخدم محدد')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        try {
            const member = interaction.member;
            const targetUser = interaction.options.getUser('user');

            // التحقق من صلاحيات الإدارة
            if (!isAdmin(member)) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`${config.emojis.error} غير مسموح`)
                    .setDescription('هذا الأمر مخصص للإدارة فقط!')
                    .setColor(config.colors.error);

                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            await interaction.deferReply();

            // تحميل بيانات التذاكر
            const data = loadTicketsData();
            const tickets = Object.values(data.tickets);

            if (targetUser) {
                // إحصائيات مستخدم محدد
                await showUserStats(interaction, targetUser, tickets);
            } else {
                // إحصائيات عامة متقدمة
                await showGeneralStats(interaction, tickets, data);
            }

        } catch (error) {
            console.error('خطأ في عرض الإحصائيات:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.error} خطأ في الإحصائيات`)
                .setDescription('حدث خطأ أثناء تحميل الإحصائيات.')
                .setColor(config.colors.error);

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};

async function showUserStats(interaction, targetUser, tickets) {
    const userTickets = tickets.filter(ticket => ticket.userId === targetUser.id);
    
    if (userTickets.length === 0) {
        const noTicketsEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.ticket} إحصائيات المستخدم`)
            .setDescription(`${targetUser} لم ينشئ أي تذاكر بعد.`)
            .setColor(config.colors.info)
            .setThumbnail(targetUser.displayAvatarURL());

        return await interaction.editReply({ embeds: [noTicketsEmbed] });
    }

    const openTickets = userTickets.filter(ticket => ticket.status === 'open').length;
    const closedTickets = userTickets.filter(ticket => ticket.status === 'closed').length;
    
    // حساب متوسط مدة التذاكر المغلقة
    const closedTicketsWithDuration = userTickets.filter(ticket => ticket.status === 'closed' && ticket.closedAt);
    let averageDuration = 'غير متاح';
    
    if (closedTicketsWithDuration.length > 0) {
        const totalDuration = closedTicketsWithDuration.reduce((total, ticket) => {
            const duration = new Date(ticket.closedAt) - new Date(ticket.createdAt);
            return total + duration;
        }, 0);
        
        const avgMs = totalDuration / closedTicketsWithDuration.length;
        const avgHours = Math.round(avgMs / (1000 * 60 * 60));
        averageDuration = `${avgHours} ساعة`;
    }

    // تصنيف التذاكر حسب النوع
    const ticketTypes = {
        support: userTickets.filter(ticket => ticket.ticketType === 'support').length,
        complaint: userTickets.filter(ticket => ticket.ticketType === 'complaint').length,
        report: userTickets.filter(ticket => ticket.ticketType === 'report').length,
        prize: userTickets.filter(ticket => ticket.ticketType === 'prize').length
    };

    const userStatsEmbed = new EmbedBuilder()
        .setTitle(`${config.emojis.ticket} إحصائيات ${targetUser.displayName}`)
        .setDescription(`
**📊 الإحصائيات العامة:**
• إجمالي التذاكر: **${userTickets.length}**
• التذاكر المفتوحة: **${openTickets}** 🟢
• التذاكر المغلقة: **${closedTickets}** 🔴
• متوسط مدة الحل: **${averageDuration}** ⏱️

**📋 التذاكر حسب النوع:**
• ${config.emojis.support} دعم فني: **${ticketTypes.support}**
• ${config.emojis.complaint} شكاوى: **${ticketTypes.complaint}**
• ${config.emojis.report} إبلاغات: **${ticketTypes.report}**
• ${config.emojis.prize} جوائز: **${ticketTypes.prize}**
        `)
        .setColor(config.colors.info)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

    // عرض آخر 5 تذاكر
    if (userTickets.length > 0) {
        const recentTickets = userTickets
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5)
            .map(ticket => {
                const status = ticket.status === 'open' ? '🟢 مفتوحة' : '🔴 مغلقة';
                const typeEmojis = {
                    'support': config.emojis.support,
                    'complaint': config.emojis.complaint,
                    'report': config.emojis.report,
                    'prize': config.emojis.prize
                };
                
                return `• #${ticket.ticketNumber} ${typeEmojis[ticket.ticketType]} - ${status}`;
            })
            .join('\n');

        userStatsEmbed.addFields({
            name: '📋 آخر التذاكر',
            value: recentTickets,
            inline: false
        });
    }

    await interaction.editReply({ embeds: [userStatsEmbed] });
}

async function showGeneralStats(interaction, tickets, data) {
    const totalTickets = tickets.length;
    const openTickets = tickets.filter(ticket => ticket.status === 'open').length;
    const closedTickets = tickets.filter(ticket => ticket.status === 'closed').length;
    const claimedTickets = tickets.filter(ticket => ticket.claimedBy).length;

    // إحصائيات الوقت
    const today = new Date();
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayTickets = tickets.filter(ticket => 
        new Date(ticket.createdAt).toDateString() === today.toDateString()
    ).length;

    const weekTickets = tickets.filter(ticket => 
        new Date(ticket.createdAt) >= thisWeek
    ).length;

    const monthTickets = tickets.filter(ticket => 
        new Date(ticket.createdAt) >= thisMonth
    ).length;

    // أكثر المستخدمين إنشاءً للتذاكر
    const userTicketCounts = {};
    tickets.forEach(ticket => {
        userTicketCounts[ticket.userId] = (userTicketCounts[ticket.userId] || 0) + 1;
    });

    const topUsers = Object.entries(userTicketCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([userId, count]) => {
            const user = interaction.guild.members.cache.get(userId);
            return `• ${user ? user.displayName : 'مستخدم غير معروف'}: **${count}** تذكرة`;
        })
        .join('\n') || 'لا توجد بيانات';

    // أكثر أعضاء الإدارة نشاطاً
    const adminActivity = {};
    tickets.filter(ticket => ticket.claimedBy).forEach(ticket => {
        adminActivity[ticket.claimedBy] = (adminActivity[ticket.claimedBy] || 0) + 1;
    });

    const topAdmins = Object.entries(adminActivity)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([adminId, count]) => {
            const admin = interaction.guild.members.cache.get(adminId);
            return `• ${admin ? admin.displayName : 'مدير غير معروف'}: **${count}** تذكرة`;
        })
        .join('\n') || 'لا توجد بيانات';

    const advancedStatsEmbed = new EmbedBuilder()
        .setTitle(`${config.emojis.ticket} إحصائيات متقدمة للتذاكر`)
        .setDescription(`
**📊 الإحصائيات العامة:**
• إجمالي التذاكر: **${totalTickets}**
• التذاكر المفتوحة: **${openTickets}** 🟢
• التذاكر المغلقة: **${closedTickets}** 🔴
• التذاكر المستلمة: **${claimedTickets}** ✋

**📅 إحصائيات زمنية:**
• اليوم: **${todayTickets}** تذكرة
• هذا الأسبوع: **${weekTickets}** تذكرة
• هذا الشهر: **${monthTickets}** تذكرة

**🔢 رقم التذكرة التالي:** #${data.nextTicketNumber.toString().padStart(4, '0')}
        `)
        .addFields(
            {
                name: '👥 أكثر المستخدمين نشاطاً',
                value: topUsers,
                inline: true
            },
            {
                name: '🛡️ أكثر المدراء نشاطاً',
                value: topAdmins,
                inline: true
            }
        )
        .setColor(config.colors.info)
        .setThumbnail(interaction.guild.iconURL())
        .setFooter({ text: 'نظام التذاكر الاحترافي' })
        .setTimestamp();

    await interaction.editReply({ embeds: [advancedStatsEmbed] });
}