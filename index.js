const { Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Botun ihtiyaç duyduğu yetkileri (Intents) tanımlıyoruz
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Bot hazır olduğunda konsola yazı yazsın
client.on('ready', () => {
    console.log(`🤖 Bot ${client.user.tag} olarak başarıyla giriş yaptı!`);
});

// ÖRNEK KOMUT: Sunucuya biri "!panel" yazınca butonlu mesajı atar
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!panel') {
        const buton = new ButtonBuilder()
            .setCustomId('id_sorgula_buton')
            .setLabel('Kullanıcı ID Sorgula')
            .setStyle(ButtonStyle.Primary);

        const satir = new ActionRowBuilder().addComponents(buton);

        const embed = new EmbedBuilder()
            .setTitle('🌐 Veritabanı Sorgu Paneli')
            .setDescription('Aşağıdaki butona tıklayarak sistemde kayıtlı olan Discord ID bilgilerine ulaşabilirsiniz.')
            .setColor('#2F3136');

        await message.channel.send({ embeds: [embed], components: [satir] });
    }
});

// Etkileşimleri (Buton ve Form Gönderimlerini) Dinliyoruz
client.on('interactionCreate', async (interaction) => {
    
    // 1. DURUM: Kullanıcı BUTONA bastığında Form (Modal) açalım
    if (interaction.isButton()) {
        if (interaction.customId === 'id_sorgula_buton') {
            const modal = new ModalBuilder()
                .setCustomId('id_sorgu_formu')
                .setTitle('Kullanıcı Sorgulama Formu');

            const idInput = new TextInputBuilder()
                .setCustomId('kullanici_id_input')
                .setLabel('Sorgulanacak Discord ID Girin:')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Örn: 714099961549160508')
                .setRequired(true);

            const satir = new ActionRowBuilder().addComponents(idInput);
            modal.addComponents(satir);

            await interaction.showModal(modal);
        }
    }

    // 2. DURUM: Kullanıcı formu doldurup GÖNDER'e bastığında
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'id_sorgu_formu') {
            const girilenDiscordId = interaction.fields.getTextInputValue('kullanici_id_input');

            // Mesajın SADECE sorgulayan kişiye özel (gizli) gözükmesi için erteliyoruz
            await interaction.deferReply({ ephemeral: true });

            const dosyaYolu = path.join(__dirname, 'data.json');

            // data.json dosyasını okuyoruz
            fs.readFile(dosyaYolu, 'utf8', (err, data) => {
                if (err) {
                    console.error("Dosya okunurken hata oluştu:", err);
                    return interaction.editReply({ content: "❌ `data.json` dosyası okunamadı!" });
                }

                try {
                    const veriTabani = JSON.parse(data);
                    // users listesinde girilen id'yi arıyoruz
                    const userData = veriTabani.users.find(user => user.discord_id === girilenDiscordId);

                    // Eğer ID bulunamazsa
                    if (!userData) {
                        return interaction.editReply({
                            content: `❌ Veritabanında \`${girilenDiscordId}\` ID'sine ait hiçbir kayıt bulunamadı.`
                        });
                    }

                    // --- ÜYELİK TİPİ KONTROLÜ (PREMIUM YERİNE NITRO) ---
                    let uyeliTipi = "";
                    if (userData.subscription_type === "free") {
                        uyeliTipi = "🆓 Ücretsiz (Free)";
                    } else {
                        uyeliTipi = "🔮 Nitro"; // Dosyada free dışında ne yazarsa yazsın Nitro gösterecek
                    }

                    // Null veya boş gelen verileri Türkçe düzenliyoruz
                    const aktiflikDurumu = userData.is_active === 1 ? "🟢 Aktif" : "🔴 Pasif";
                    const kalanGun = userData.days_remaining ? `${userData.days_remaining} Gün` : "Sınırsız / Yok";
                    const bitisTarihi = userData.subscription_end_date_formatted ? userData.subscription_end_date_formatted : "Mevcut Değil";

                    // Şık Türkçe Embed Tasarımı
                    const sonucEmbed = new EmbedBuilder()
                        .setTitle(`📋 Kullanıcı Bilgi Paneli (${userData.username})`)
                        .setDescription(`\`${girilenDiscordId}\` ID'li kullanıcıya ait güncel veriler:`)
                        .setColor('#5865F2')
                        .setThumbnail(userData.avatar_hash ? `https://cdn.discordapp.com/avatars/${userData.discord_id}/${userData.avatar_hash}.png` : null)
                        .addFields(
                            { name: '👤 Kullanıcı Adı', value: `\`${userData.username}\``, inline: true },
                            { name: '🆔 Sistem No', value: `\`#${userData.id}\``, inline: true },
                            { name: '📧 E-Posta Adresi', value: `\`${userData.email}\``, inline: false },
                            
                            { name: '💎 Üyelik Türü', value: `\`${uyeliTipi}\``, inline: true },
                            { name: '⚡ Hesap Durumu', value: `\`${aktiflikDurumu} / ${userData.activity_status}\``, inline: true },
                            { name: '⏳ Kalan Süre', value: `\`${kalanGun}\``, inline: true },
                            
                            { name: '📊 Bugün Yapılan Sorgu', value: `\`${userData.queries_today} / ${userData.daily_limit}\``, inline: true },
                            { name: '📈 Toplam Sorgu', value: `\`${userData.total_queries}\``, inline: true },
                            { name: '📆 Üyelik Bitiş', value: `\`${bitisTarihi}\``, inline: true },

                            { name: '📅 Kayıt Tarihi', value: `\`${userData.created_at}\``, inline: false },
                            { name: '🕒 Son Giriş Tarihi', value: `\`${userData.last_login}\``, inline: false },
                            { name: '🌐 Kayıt / Son Giriş IP', value: `\`${userData.registration_ip}\` / \`${userData.last_ip}\``, inline: false }
                        )
                        .setFooter({ text: `Sorgulama Başarılı` })
                        .setTimestamp();

                    // Sadece sorguyu yapana gizli yanıt olarak gönderiyoruz
                    interaction.editReply({ embeds: [sonucEmbed] });

                } catch (jsonHatasi) {
                    console.error("JSON Ayrıştırma Hatası:", jsonHatasi);
                    interaction.editReply({ content: "❌ Dosya formatı çözümlenemedi (JSON Hatası)!" });
                }
            });
        }
    }
});

// TOKENİ GÜVENLİ ŞEKİLDE REPLIT SECRETS (ENV) ÜZERİNDEN ÇEKİYORUZ
client.login(process.env.TOKEN);
