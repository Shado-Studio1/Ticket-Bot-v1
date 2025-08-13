const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('إعداد نظام التذاكر')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('القناة التي سيتم إرسال رسالة التذاكر فيها')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        try {
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

            // إنشاء embed الرئيسي
            const setupEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.ticket} مرحباً بك في نظام التذاكر`)
                .setDescription(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎟️  **نظام التذاكر الاحترافي**  🎟️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**هل تحتاج إلى مساعدة؟** 🤝
نحن هنا لمساعدتك! يمكنك إنشاء تذكرة جديدة للحصول على الدعم المطلوب.

**📋 الخدمات المتاحة:**
${config.emojis.support} **دعم فني** - للمساعدة التقنية والحلول
${config.emojis.complaint} **شكوى** - لتقديم الشكاوى والاقتراحات  
${config.emojis.report} **إبلاغ** - للإبلاغ عن المشاكل والمخالفات
${config.emojis.prize} **استلام جائزة** - لاستلام الجوائز والمكافآت

**✨ المميزات:**
• 🚀 استجابة سريعة من فريق الدعم
• 📊 تتبع حالة تذكرتك بسهولة
• 📎 إمكانية إرفاق الصور والملفات
• 💬 حفظ سجل كامل للمحادثة
• 🔒 خصوصية تامة لتذكرتك

**👇 اضغط على الزر أدناه لإنشاء تذكرة جديدة**
                `)
                .setColor(config.colors.primary)
                .setThumbnail(config.images?.ticketThumbnail || interaction.guild.iconURL())
                .setImage(config.images?.welcomeBanner || null)
                .setFooter({ 
                    text: 'نظام التذاكر الاحترافي • اضغط على الزر للبدء', 
                    iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();

            // إنشاء زر إنشاء التذكرة
            const createTicketButton = new ButtonBuilder()
                .setCustomId('create_ticket_start')
                .setLabel('إنشاء تذكرة جديدة')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎟️');

            const row = new ActionRowBuilder().addComponents(createTicketButton);

            // إرسال الرسالة في القناة المحددة
            await targetChannel.send({
                embeds: [setupEmbed],
                components: [row]
            });

            // رد على المستخدم
            const successEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.success} تم إعداد نظام التذاكر`)
                .setDescription(`تم إرسال رسالة نظام التذاكر بنجاح في ${targetChannel}!\n\nيمكن للأعضاء الآن الضغط على الزر لإنشاء تذاكر جديدة.`)
                .setColor(config.colors.success)
                .setFooter({ text: 'نظام التذاكر جاهز للاستخدام!' });

            await interaction.reply({ embeds: [successEmbed], ephemeral: true });

        } catch (error) {
            console.error('خطأ في إعداد نظام التذاكر:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.error} خطأ في الإعداد`)
                .setDescription('حدث خطأ أثناء إعداد نظام التذاكر.')
                .setColor(config.colors.error);

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};