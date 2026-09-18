require('dotenv').config();
const { 
    Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    EmbedBuilder, ChannelType, PermissionsBitField, StringSelectMenuBuilder 
} = require('discord.js');

// --- CONFIGURATION ---
const CATEGORY_ID = '1550483385699405924'; 
const SUPPORT_ROLE_ID = '1444786378104897619'; 
// ---------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Ticket Bot online! Logged in as: ${client.user.tag}`);
});

// 1. Comando per inviare il menu a tendina
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!panel') {
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
        await message.delete().catch(() => {});
    }
});

// 2. Gestione del Menu e del pulsante di chiusura
client.on('interactionCreate', async (interaction) => {
    
    // --- CREAZIONE TICKET ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const ticketType = interaction.values[0];
        const userName = interaction.user.username.toLowerCase();
        
        // Evita che l'utente apra più ticket contemporaneamente
        const existingChannel = interaction.guild.channels.cache.find(c => c.name.includes(`ticket-${userName}`));
        if (existingChannel) {
            return interaction.reply({ content: `You already have an open ticket here: ${existingChannel}`, ephemeral: true });
        }

        await interaction.reply({ content: 'Creating your ticket...', ephemeral: true });

        // Crea il canale
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

        // Imposta messaggio in base alla scelta
        let embedDesc = '';
        let embedColor = '';

        switch (ticketType) {
            case 'collab':
                embedDesc = `Welcome <@${interaction.user.id}>!\n\nThank you for your interest. Please provide details about your channel, audience, or the type of collaboration/sponsorship you are proposing.\n\nA member of our staff will review your proposal shortly.`;
                embedColor = '#7a0791'; 
                break;
            case 'assistance':
                embedDesc = `Welcome <@${interaction.user.id}>!\n\nPlease describe the issue you are facing or the question you have in as much detail as possible.\n\nOur staff will assist you as soon as they are available.`;
                embedColor = '#7a0791'; 
                break;
            case 'tweak':
                embedDesc = `Welcome <@${interaction.user.id}>!\n\nLooking for extra performance? Please describe your current system specs, the issues you are experiencing, and what kind of tweaks you are looking for.\n\nOur experts will be with you shortly.`;
                embedColor = '#7a0791'; 
                break;
        }

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`Ticket: ${ticketType.toUpperCase()}`)
            .setDescription(embedDesc)
            .setColor(embedColor)
            .setFooter({ text: 'To close this ticket, click the button below.'});

        const closeButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );

        // Pinga l'utente e lo staff fuori dall'embed (per far arrivare la notifica push)
        await ticketChannel.send({ content: `<@${interaction.user.id}> | <@&${SUPPORT_ROLE_ID}>`, embeds: [welcomeEmbed], components: [closeButton] });

        // Aggiorna il messaggio temporaneo
        await interaction.editReply({ content: `Your ticket has been created: ${ticketChannel}` });
    }

    // --- CHIUSURA TICKET ---
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply({ content: 'Ticket will be permanently closed in 5 seconds...' });
        
        setTimeout(() => {
            interaction.channel.delete().catch(console.error);
        }, 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);