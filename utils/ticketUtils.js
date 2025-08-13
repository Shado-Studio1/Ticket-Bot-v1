const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');
const fs = require('fs');
const path = require('path');

// ملف لحفظ بيانات التذاكر
const ticketsDataPath = path.join(__dirname, '..', 'data', 'tickets.json');

// إنشاء مجلد البيانات إذا لم يكن موجوداً
const dataDir = path.dirname(ticketsDataPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// تحميل بيانات التذاكر
function loadTicketsData() {
    try {
        if (fs.existsSync(ticketsDataPath)) {
            const data = fs.readFileSync(ticketsDataPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('خطأ في تحميل بيانات التذاكر:', error);
    }
    return { nextTicketNumber: 1, tickets: {} };
}

// حفظ بيانات التذاكر
function saveTicketsData(data) {
    try {
        fs.writeFileSync(ticketsDataPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('خطأ في حفظ بيانات التذاكر:', error);
    }
}

// إنشاء رقم تذكرة جديد
function getNextTicketNumber() {
    const data = loadTicketsData();
    const ticketNumber = data.nextTicketNumber;
    data.nextTicketNumber++;
    saveTicketsData(data);
    return ticketNumber.toString().padStart(4, '0');
}

// إنشاء قناة تذكرة جديدة
async function createTicketChannel(guild, user, ticketType, ticketNumber) {
    try {
        const channelName = `ticket-${ticketNumber}`;
        
        // إنشاء القناة
        const channel = await guild.channels.create({
            name: channelName,
            type: 0, // TEXT_CHANNEL
            parent: config.ticketCategory,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ],
                },
                ...config.adminRoles.map(roleId => ({
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages,
                        PermissionFlagsBits.AttachFiles
                    ],
                }))
            ],
        });

        // حفظ بيانات التذكرة
        const data = loadTicketsData();
        data.tickets[channel.id] = {
            ticketNumber,
            userId: user.id,
            ticketType,
            createdAt: new Date().toISOString(),
            claimedBy: null,
            claimedAt: null,
            status: 'open'
        };
        saveTicketsData(data);

        return channel;
    } catch (error) {
        console.error('خطأ في إنشاء قناة التذكرة:', error);
        throw error;
    }
}

// إنشاء embed للتذكرة
function createTicketEmbed(ticketNumber, user, ticketType) {
    const typeEmojis = {
        'support': config.emojis.support,
        'complaint': config.emojis.complaint,
        'report': config.emojis.report,
        'prize': config.emojis.prize
    };

    const typeNames = {
        'support': 'دعم فني',
        'complaint': 'شكوى',
        'report': 'إبلاغ',
        'prize': 'استلام جائزة'
    };

    return new EmbedBuilder()
        .setTitle(`${config.emojis.ticket} تذكرة رقم #${ticketNumber}`)
        .setDescription(`**نوع التذكرة:** ${typeEmojis[ticketType]} ${typeNames[ticketType]}\n**تم الإنشاء بواسطة:** ${user}\n**الحالة:** 🟢 مفتوحة`)
        .setColor(config.colors.primary)
        .setTimestamp()
        .setFooter({ text: 'نظام التذاكر الاحترافي' });
}

// إنشاء أزرار التحكم في التذكرة
function createTicketButtons(isAdmin = false) {
    const row = new ActionRowBuilder();

    if (isAdmin) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('claim_ticket')
                .setLabel('استلام التذكرة')
                .setEmoji(config.emojis.claim)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('call_admin')
                .setLabel('نداء الإدارة')
                .setEmoji(config.emojis.call)
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('إغلاق التذكرة')
                .setEmoji(config.emojis.close)
                .setStyle(ButtonStyle.Danger)
        );
    } else {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('call_admin')
                .setLabel('نداء الإدارة')
                .setEmoji(config.emojis.call)
                .setStyle(ButtonStyle.Secondary)
        );
    }

    return row;
}

// التحقق من صلاحيات الإدارة
function isAdmin(member) {
    return config.adminRoles.some(roleId => member.roles.cache.has(roleId));
}

// حساب مدة التذكرة
function calculateTicketDuration(createdAt, closedAt = new Date()) {
    const created = new Date(createdAt);
    const closed = new Date(closedAt);
    const duration = closed - created;
    
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    let result = '';
    if (days > 0) result += `${days} يوم `;
    if (hours > 0) result += `${hours} ساعة `;
    if (minutes > 0) result += `${minutes} دقيقة`;
    
    return result || 'أقل من دقيقة';
}

// إنشاء تقرير إغلاق التذكرة
function createCloseReport(ticketData, closedBy, guild) {
    const user = guild.members.cache.get(ticketData.userId);
    const claimer = ticketData.claimedBy ? guild.members.cache.get(ticketData.claimedBy) : null;
    const duration = calculateTicketDuration(ticketData.createdAt);

    const typeNames = {
        'support': 'دعم فني',
        'complaint': 'شكوى',
        'report': 'إبلاغ',
        'prize': 'استلام جائزة'
    };

    return new EmbedBuilder()
        .setTitle(`${config.emojis.close} تقرير إغلاق التذكرة #${ticketData.ticketNumber}`)
        .addFields(
            { name: '📋 نوع التذكرة', value: typeNames[ticketData.ticketType] || 'غير محدد', inline: true },
            { name: '👤 تم الإنشاء بواسطة', value: user ? user.toString() : 'مستخدم غير معروف', inline: true },
            { name: '✋ تم الاستلام بواسطة', value: claimer ? claimer.toString() : 'لم يتم الاستلام', inline: true },
            { name: '🔒 تم الإغلاق بواسطة', value: closedBy.toString(), inline: true },
            { name: '⏱️ مدة التذكرة', value: duration, inline: true },
            { name: '📅 تاريخ الإنشاء', value: `<t:${Math.floor(new Date(ticketData.createdAt).getTime() / 1000)}:F>`, inline: true }
        )
        .setColor(config.colors.error)
        .setTimestamp()
        .setFooter({ text: 'نظام التذاكر الاحترافي' });
}

module.exports = {
    loadTicketsData,
    saveTicketsData,
    getNextTicketNumber,
    createTicketChannel,
    createTicketEmbed,
    createTicketButtons,
    isAdmin,
    calculateTicketDuration,
    createCloseReport
};