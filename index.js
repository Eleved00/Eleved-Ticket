require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    EmbedBuilder, ChannelType, PermissionsBitField, StringSelectMenuBuilder 
} = require('discord.js');
const http = require('http');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ==========================================
// 1. WEB SERVER PER UPTIMEROBOT (24/7)
// ==========================================
http.createServer((req, res) => {
    res.end('Ticket Bot online e funzionante!');
}).listen(process.env.PORT || 3000);

// ==========================================
// 2. CONFIGURAZIONE ID E RUOLI
// ==========================================
const CATEGORY_ID = '1550483385699405924'; 
const SUPPORT_ROLE_ID = '1444786378104897619'; 

// ==========================================
// 3. CONFIGURAZIONE DISCORD CLIENT
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// ==========================================
// 4. CONFIGURAZIONE GEMINI AI
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const ticketAIChats = new Map(); // Memoria temporanea per le chat AI nei ticket

// Istruzioni per l'IA: Stile professionale e minimale (Org Esports)
const systemInstruction = `Sei l'Assistente AI ufficiale di questo server Discord.
Il tuo stile deve essere estremamente equilibrato, minimale e professionale, simile al supporto di un'organizzazione eSports di alto livello.
Non usare troppe emoji, mantieni le risposte concise, focalizzate e orientate alla risoluzione del problema.
Regole del server:
1. Non sono previsti rimborsi per i servizi.
2. Per il recruiting o candidature staff, analizza la richiesta e chiedi il portfolio.
Se una richiesta richiede interventi nei log, sban, pagamenti o azioni non coperte dalla tua conoscenza tecnica, invita cortesemente l'utente ad attendere un membro dello staff umano.`;

const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: systemInstruction
});

// ==========================================
// 5. AVVIO DEL BOT
// ==========================================
client.once('ready', () => {
    console.log(`[SYSTEM] Ticket Bot online! Logged in as: ${client.user.tag}`);
});

// ==========================================
// 6. GESTIONE MESSAGGI IN CHAT E AI
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- COMANDO PANEL ---
    if (message.content === '!panel') {
        // Elimina in automatico il comando inviato dall'utente
        await message.delete().catch(() => {});

        const embed = new EmbedBuilder()
            .setTitle('🛠️ Server Support Center')
            .setDescription('Please select the type of ticket you wish to open from the menu below.\n\nUse this system only for genuine inquiries.')
            .setColor('#7a0791');

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('Select a ticket category...')
                .addOptions([
                    {
                        label: 'Collab / Sponsor',
                        description: 'Business inquiries, sponsorships, or collaborations',
                        value: 'collab',
                        emoji: '🤝',
                    },
                    {
                        label: 'Assistance',
                        description: 'General help, server issues, or questions',
                        value: 'assistance',
                        emoji: '🆘',
                    },
                    {
                        label: 'Tweak',
                        description: 'PC Optimization, custom tweaks, and performance issues',
                        value: 'tweak',
                        emoji: '🚀',
                    }
                ])
        );

        await message.channel.send({ embeds: [embed], components: [selectMenu] });
        return;
    }

    // --- GESTIONE CHAT IA NEI TICKET ---
    if (ticketAIChats.has(message.channel.id)) {
        try {
            await message.channel.sendTyping();
            const chat = ticketAIChats.get(message.channel.id);
            const result = await chat.sendMessage(message.content);
            await message.reply(result.response.text());
        } catch (error) {
            console.error("[ERRORE GEMINI]", error?.message||error);
            if(error?.status)console.error("[ERRORE GEMINI] status:",error.status);
            await message.reply("Errore di connessione ai server AI:${error?.message||'errore sconosciuto'}. Controlla i log.");
        }
    }
});

// ==========================================
// 7. GESTIONE DEL MENU E DEI PULSANTI
// ==========================================
client.on('interactionCreate', async (interaction) => {
    
    // --- CREAZIONE TICKET DAL MENU A TENDINA ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const ticketType = interaction.values[0];
        const userName = interaction.user.username.toLowerCase();
        
        // Controllo ticket duplicati
        const existingChannel = interaction.guild.channels.cache.find(c => c.name.includes(`ticket-${userName}`));
        if (existingChannel) {
            return interaction.reply({ content: `You already have an open ticket here: ${existingChannel}`, ephemeral: true });
        }

        await interaction.reply({ content: 'Creating your ticket...', ephemeral: true });

        // Creazione Canale
        const ticketChannel = await interaction.guild.channels.create({
            name: `${ticketType}-ticket-${userName}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                {
                    id: interaction.guild.id, 
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: interaction.user.id, 
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles],
                },
                {
                    id: SUPPORT_ROLE_ID, 
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles],
                }
            ],
        });

        // Testi del tuo codice originale in base alla selezione
        let embedDesc = '';
        switch (ticketType) {
            case 'collab':
                embedDesc = `Welcome <@${interaction.user.id}>!\n\nThank you for your interest. Please provide details about your channel, audience, or the type of collaboration/sponsorship you are proposing.\n\nA member of our staff will review your proposal shortly.`;
                break;
            case 'assistance':
                embedDesc = `Welcome <@${interaction.user.id}>!\n\nPlease describe the issue you are facing or the question you have in as much detail as possible.\n\nOur staff will assist you as soon as they are available.`;
                break;
            case 'tweak':
                embedDesc = `Welcome <@${interaction.user.id}>!\n\nLooking for extra performance? Please describe your current system specs, the issues you are experiencing, and what kind of tweaks you are looking for.\n\nOur experts will be with you shortly.`;
                break;
        }

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`Ticket: ${ticketType.toUpperCase()}`)
            .setDescription(embedDesc)
            .setColor('#7a0791')
            .setFooter({ text: 'Scegli la modalità di assistenza qui sotto.'});

        // I tre pulsanti iniziali (Staff, AI, e Chiudi in rosso)
        const actionButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_wait_admin')
                .setLabel('👤 Attendi Staff')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('btn_use_ai')
                .setLabel('🤖 Usa Assistente AI')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Chiudi')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );

        // Invio del messaggio completo
        await ticketChannel.send({ 
            content: `<@${interaction.user.id}> | <@&${SUPPORT_ROLE_ID}>\n**Come preferisci procedere?** Puoi richiedere l'intervento dello staff oppure provare la nostra IA addestrata per una risposta immediata.`, 
            embeds: [welcomeEmbed], 
            components: [actionButtons] 
        });

        await interaction.editReply({ content: `Your ticket has been created: ${ticketChannel}` });
    }

    // --- LOGICA DEI PULSANTI ---
    if (interaction.isButton()) {
        
        // L'utente sceglie di attendere lo staff
        if (interaction.customId === 'btn_wait_admin') {
            // Rimuove i pulsanti di scelta AI/Staff e lascia solo il lucchetto di chiusura
            const closeOnlyRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
            );
            await interaction.update({ components: [closeOnlyRow] });
            await interaction.followUp({ content: `Hai scelto il supporto manuale. Il nostro team è stato notificato e interverrà appena possibile.` });
        }

        // L'utente sceglie di usare l'AI
        if (interaction.customId === 'btn_use_ai') {
            const closeOnlyRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
            );
            await interaction.update({ components: [closeOnlyRow] });

            // Inizializza la memoria della chat isolata per questo specifico ticket
            const chat = model.startChat({ history: [] });
            ticketAIChats.set(interaction.channel.id, chat);

            await interaction.followUp({ content: `✅ **Assistente AI Inizializzato.**\nSono qui per aiutarti. Descrivi la tua richiesta nel dettaglio.` });
        }

        // Chiusura del ticket
        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: 'Ticket will be permanently closed in 5 seconds...' });
            
            // Se c'era una conversazione AI in questo canale, la pulisce dalla memoria
            if (ticketAIChats.has(interaction.channel.id)) {
                ticketAIChats.delete(interaction.channel.id);
            }

            setTimeout(() => {
                interaction.channel.delete().catch(console.error);
            }, 5000);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);