const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

class ErrorHandler {
    static async handleError(error, interaction = null, context = 'Unknown') {
        console.error(`[${new Date().toISOString()}] خطأ في ${context}:`, error);

        if (interaction) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${config.emojis.error} حدث خطأ`)
                .setDescription('عذراً، حدث خطأ أثناء تنفيذ هذا الإجراء. يرجى المحاولة مرة أخرى.')
                .setColor(config.colors.error)
                .setTimestamp()
                .setFooter({ text: 'إذا استمر الخطأ، يرجى التواصل مع الإدارة' });

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
                } else {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            } catch (replyError) {
                console.error('خطأ في إرسال رسالة الخطأ:', replyError);
            }
        }

        // إرسال الخطأ لقناة السجلات إذا كانت متاحة
        if (config.logChannel && interaction?.guild) {
            try {
                const logChannel = interaction.guild.channels.cache.get(config.logChannel);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🚨 تقرير خطأ')
                        .addFields(
                            { name: 'السياق', value: context, inline: true },
                            { name: 'المستخدم', value: interaction.user?.tag || 'غير معروف', inline: true },
                            { name: 'القناة', value: interaction.channel?.name || 'غير معروف', inline: true },
                            { name: 'الخطأ', value: `\`\`\`${error.message || error}\`\`\``, inline: false }
                        )
                        .setColor(config.colors.error)
                        .setTimestamp();

                    await logChannel.send({ embeds: [logEmbed] });
                }
            } catch (logError) {
                console.error('خطأ في إرسال السجل:', logError);
            }
        }
    }

    static async handleCommandError(error, interaction) {
        await this.handleError(error, interaction, `الأمر: ${interaction.commandName}`);
    }

    static async handleButtonError(error, interaction) {
        await this.handleError(error, interaction, `الزر: ${interaction.customId}`);
    }

    static async handleSelectMenuError(error, interaction) {
        await this.handleError(error, interaction, `القائمة: ${interaction.customId}`);
    }
}

module.exports = ErrorHandler;