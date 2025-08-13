const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { 
    getNextTicketNumber, 
    createTicketChannel, 
    createTicketEmbed, 
    createTicketButtons, 
    isAdmin, 
    loadTicketsData, 
    saveTicketsData,
    createCloseReport
} = require('../utils/ticketUtils');
const ErrorHandler = require('../utils/errorHandler');
const config = require('../config.json');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // معالجة أوامر Slash
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`لا يوجد أمر مطابق لـ ${interaction.commandName}.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                await ErrorHandler.handleCommandError(error, interaction);
            }
        }
        
        // معالجة القوائم المنسدلة
        else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_type') {
                await handleTicketCreation(interaction);
            }
        }
        
        // معالجة الأزرار
        else if (interaction.isButton()) {
            if (interaction.customId === 'create_ticket_start') {
                await handleStartButton(interaction);
            } else if (interaction.customId === 'claim_ticket') {
                await handleClaimTicket(interaction);
            } else if (interaction.customId === 'call_admin') {
                await handleCallAdmin(interaction);
            } else if (interaction.customId === 'close_ticket') {
                await handleCloseTicket(interaction);
            }
        }
    },
};

// معالجة إنشاء التذكرة
async function handleTicketCreation(interaction) {
    try {
        const ticketType = interaction.values[0];
        const user = interaction.user;
        const guild = interaction.guild;

        // التحقق من وجود تذكرة مفتوحة للمستخدم
        const data = loadTicketsData();
        const existingTicket = Object.values(data.tickets).find(
            ticket => ticket.userId === user.id && ticket.status === 'open'
        );

        if (existingTicket) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.error} تذكرة موجودة بالفعل`)
                .setDescription(`لديك تذكرة مفتوحة بالفعل: #${existingTicket.ticketNumber}`)
                .setColor(config.colors.error);

            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // إنشاء رقم التذكرة
        const ticketNumber = getNextTicketNumber();

        // إنشاء قناة التذكرة
        const channel = await createTicketChannel(guild, user, ticketType, ticketNumber);

        // إنشاء embed التذكرة
        const ticketEmbed = createTicketEmbed(ticketNumber, user, ticketType);

        // إنشاء أزرار التحكم
        const buttons = createTicketButtons(true);

        // إرسال رسالة في قناة التذكرة
        const welcomeMessage = await channel.send({
            content: `${user} مرحباً بك في تذكرتك الجديدة!\n${config.adminRoles.map(roleId => `<@&${roleId}>`).join(' ')}`,
            embeds: [ticketEmbed],
            components: [buttons]
        });

        // إرسال رسالة إرشادية لإرفاق الصور
        const instructionEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.info} إرشادات التذكرة`)
            .setDescription(`
**📝 كيفية استخدام التذكرة:**

• **وصف المشكلة**: اكتب وصفاً واضحاً ومفصلاً لمشكلتك
• **إرفاق الصور**: يمكنك سحب وإسقاط الصور مباشرة في هذه القناة
• **إرفاق الملفات**: يمكنك إرفاق أي ملفات مساعدة (حتى 25 ميجابايت)
• **الانتظار**: سيقوم فريق الدعم بالرد عليك في أقرب وقت ممكن

**🔧 أزرار التحكم:**
• ${config.emojis.claim} **استلام التذكرة** - للإدارة فقط
• ${config.emojis.call} **نداء الإدارة** - لتنبيه المسؤولين
• ${config.emojis.close} **إغلاق التذكرة** - للإدارة فقط

**💡 نصيحة:** كلما كانت المعلومات أكثر تفصيلاً، كان الحل أسرع!
            `)
            .setColor(config.colors.info)
            .setFooter({ text: 'يمكنك البدء بكتابة مشكلتك الآن' });

        await channel.send({ embeds: [instructionEmbed] });

        // رد على المستخدم
        const successEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.success} تم إنشاء التذكرة بنجاح`)
            .setDescription(`تم إنشاء تذكرتك: ${channel}\nرقم التذكرة: #${ticketNumber}`)
            .setColor(config.colors.success);

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });

    } catch (error) {
        console.error('خطأ في إنشاء التذكرة:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.error} خطأ في إنشاء التذكرة`)
            .setDescription('حدث خطأ أثناء إنشاء التذكرة. يرجى المحاولة مرة أخرى.')
            .setColor(config.colors.error);

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

// معالجة استلام التذكرة
async function handleClaimTicket(interaction) {
    try {
        const member = interaction.member;
        const channel = interaction.channel;

        // التحقق من صلاحيات الإدارة
        if (!isAdmin(member)) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.error} غير مسموح`)
                .setDescription('هذا الأمر مخصص للإدارة فقط!')
                .setColor(config.colors.error);

            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // تحديث بيانات التذكرة
        const data = loadTicketsData();
        if (data.tickets[channel.id]) {
            if (data.tickets[channel.id].claimedBy) {
                const claimer = interaction.guild.members.cache.get(data.tickets[channel.id].claimedBy);
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`${config.emojis.error} تذكرة مستلمة بالفعل`)
                    .setDescription(`هذه التذكرة مستلمة بالفعل من قبل ${claimer || 'مستخدم غير معروف'}`)
                    .setColor(config.colors.error);

                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            data.tickets[channel.id].claimedBy = member.id;
            data.tickets[channel.id].claimedAt = new Date().toISOString();
            saveTicketsData(data);

            // إنشاء embed الاستلام
            const claimEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.claim} تم استلام التذكرة`)
                .setDescription(`تم استلام هذه التذكرة بواسطة ${member}`)
                .setColor(config.colors.success)
                .setTimestamp();

            await interaction.reply({ embeds: [claimEmbed] });
        }

    } catch (error) {
        console.error('خطأ في استلام التذكرة:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.error} خطأ في الاستلام`)
            .setDescription('حدث خطأ أثناء استلام التذكرة.')
            .setColor(config.colors.error);

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

// معالجة نداء الإدارة
async function handleCallAdmin(interaction) {
    try {
        const user = interaction.user;
        const channel = interaction.channel;

        // إنشاء embed النداء
        const callEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.call} نداء الإدارة`)
            .setDescription(`${user} يطلب انتباه الإدارة في هذه التذكرة!`)
            .setColor(config.colors.warning)
            .setTimestamp();

        await interaction.reply({
            content: config.adminRoles.map(roleId => `<@&${roleId}>`).join(' '),
            embeds: [callEmbed]
        });

    } catch (error) {
        console.error('خطأ في نداء الإدارة:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.error} خطأ في النداء`)
            .setDescription('حدث خطأ أثناء نداء الإدارة.')
            .setColor(config.colors.error);

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

// معالجة إغلاق التذكرة
async function handleCloseTicket(interaction) {
    try {
        const member = interaction.member;
        const channel = interaction.channel;
        const guild = interaction.guild;

        // التحقق من صلاحيات الإدارة
        if (!isAdmin(member)) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.error} غير مسموح`)
                .setDescription('هذا الأمر مخصص للإدارة فقط!')
                .setColor(config.colors.error);

            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // الحصول على بيانات التذكرة
        const data = loadTicketsData();
        const ticketData = data.tickets[channel.id];

        if (!ticketData) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.error} تذكرة غير موجودة`)
                .setDescription('لم يتم العثور على بيانات هذه التذكرة.')
                .setColor(config.colors.error);

            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // إنشاء تقرير الإغلاق
        const closeReport = createCloseReport(ticketData, member, guild);

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
        saveTicketsData(data);

        // إرسال رسالة الإغلاق
        const closingEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.close} جاري إغلاق التذكرة`)
            .setDescription('سيتم حذف هذه القناة خلال 10 ثوانٍ...')
            .setColor(config.colors.error);

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
}

// معالجة زر البدء
async function handleStartButton(interaction) {
    try {
        const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
        
        // إنشاء embed الترحيب
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.ticket} إنشاء تذكرة جديدة`)
            .setDescription(`
مرحباً ${interaction.user}! 👋

**اختر نوع التذكرة التي تريد إنشاؤها:**

${config.emojis.support} **دعم فني** - للحصول على المساعدة التقنية
${config.emojis.complaint} **شكوى** - لتقديم شكوى أو اقتراح  
${config.emojis.report} **إبلاغ** - للإبلاغ عن مشكلة أو مخالفة
${config.emojis.prize} **استلام جائزة** - لاستلام الجوائز والمكافآت

**💡 نصائح مهمة:**
• كن واضحاً في وصف مشكلتك
• يمكنك إرفاق الصور والملفات
• سيتم الرد عليك في أقرب وقت ممكن

**👇 اختر من القائمة أدناه:**
            `)
            .setColor(config.colors.info)
            .setThumbnail(interaction.user.displayAvatarURL())
            .setFooter({ text: 'اختر نوع التذكرة من القائمة المنسدلة' })
            .setTimestamp();

        // إنشاء القائمة المنسدلة
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_type')
            .setPlaceholder('🎯 اختر نوع التذكرة...')
            .addOptions([
                {
                    label: 'دعم فني',
                    description: 'للحصول على المساعدة التقنية والدعم',
                    value: 'support',
                    emoji: config.emojis.support,
                },
                {
                    label: 'شكوى',
                    description: 'لتقديم شكوى أو اقتراح للتحسين',
                    value: 'complaint',
                    emoji: config.emojis.complaint,
                },
                {
                    label: 'إبلاغ',
                    description: 'للإبلاغ عن مشكلة أو مخالفة',
                    value: 'report',
                    emoji: config.emojis.report,
                },
                {
                    label: 'استلام جائزة',
                    description: 'لاستلام الجوائز والمكافآت المستحقة',
                    value: 'prize',
                    emoji: config.emojis.prize,
                },
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            embeds: [welcomeEmbed],
            components: [row],
            ephemeral: true
        });

    } catch (error) {
        console.error('خطأ في معالجة زر البدء:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle(`${config.emojis.error} خطأ في البدء`)
            .setDescription('حدث خطأ أثناء بدء إنشاء التذكرة.')
            .setColor(config.colors.error);

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}