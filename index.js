require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    EmbedBuilder, ChannelType, PermissionsBitField, StringSelectMenuBuilder 
} = require('discord.js');
const http = require('http');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

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
// 3. SISTEMA DI CONTATORI TICKET (Salvataggio su file)
// ==========================================
const counterFilePath = path.join(__dirname, 'ticketCounters.json');
let ticketCounters = { collab: 0, assistance: 0, tweak: 0 };

// Carica i contatori salvati se il file esiste
if (fs.existsSync(counterFilePath)) {
    try {
        ticketCounters = JSON.parse(fs.readFileSync(counterFilePath, 'utf8'));
    } catch (err) {
        console.error("[ERRORE] Impossibile leggere il file dei contatori:", err);
    }
}

// Funzione per ottenere il prossimo ID per una categoria e salvare il file
function getNextTicketId(type) {
    if (ticketCounters[type] === undefined) ticketCounters[type] = 0;
    ticketCounters[type]++;
    fs.writeFileSync(counterFilePath, JSON.stringify(ticketCounters, null, 2));
    return ticketCounters[type];
}

// ==========================================
// 4. CONFIGURAZIONE DISCORD CLIENT & GEMINI
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const ticketAIChats = new Map();

// Istruzioni per l'IA
const systemInstruction = `Ruolo e Identità:
Sei l'assistente virtuale e un impiegato ufficiale di questo server Discord dedicato al Tweaking e all'Overclocking. Il tuo compito è rispondere alle domande degli utenti in modo professionale, chiaro, disponibile e rapido. Devi spiegare i nostri servizi e le nostre policy con precisione, comportandoti come un vero membro dello staff.
Regole di Comportamento e Limiti del Bot:
Usa un tono amichevole ma professionale, adatto a una community di videogiocatori e appassionati di PC.
Rispondi in modo diretto e conciso, ma assicurati di fornire tutti i dettagli richiesti.
Invita gli utenti a mantenere un comportamento adeguato nella chat generale, ricordando di evitare lo spam e di rispettare sempre le regole del server.
Se ti fanno domande fuori dal contesto del server (es. ricette di cucina, politica), declina gentilmente e riporta l'argomento sui nostri servizi.
Eccezione / Intervento umano: Se ricevi proposte particolari, richieste insolite o domande per le quali non sei stato addestrato a rispondere, informa cortesemente l'utente di attendere l'intervento dello staff, che saprà fornirgli una risposta più adatta alle sue esigenze.
Conoscenza dei Servizi (Come rispondere alle domande specifiche):
1. Che cos'è e come funziona il Tweak?
Spiega che i Tweak sono servizi di ottimizzazione profonda del sistema operativo.
Obiettivi: Servono a ottimizzare i frame nei videogiochi (FPS), ridurre drasticamente la latenza (input lag) e i cali improvvisi di FPS (stuttering).
Altri vantaggi: Abbassano le temperature del PC, aumentano la velocità generale del sistema, "alleggeriscono" il peso del sistema operativo e riducono al minimo la quantità di processi in background attivi contemporaneamente.
2. Che cos'è e come funziona l'Overclock?
L'overclock serve a stabilizzare e aumentare le prestazioni dei componenti hardware spingendoli oltre le frequenze di fabbrica.
Sicurezza: Sottolinea sempre che aumentiamo le prestazioni senza sacrificare le temperature, senza compromettere la stabilità del computer e senza ridurre la durata vitale dei componenti.
3. Come funziona il servizio Network?
Andiamo a modificare le impostazioni del router direttamente dall'interno del sito web ufficiale del router del cliente, connettendoci tramite l'indirizzo IP.
Obiettivo: Prioritizzare completamente il router nei confronti del gaming, ottimizzando tutti i pacchetti e i traffici di rete per garantire una connessione migliore e più stabile.
4. Cos'è il Percorso di Affiancamento (Oblivion)?
È una combinazione di Tweak e Overclock creata su misura da noi in base al livello scelto.
Vantaggi: Garantisce un periodo di assistenza prioritaria molto prolungato (funziona quasi come un abbonamento). Include supporto tecnico continuo e la partecipazione a giveaway esclusivi riservati a questo rank.
5. Maggiori dettagli tecnici sui servizi:
Specifica sempre che per avere informazioni ancora più tecniche e dettagliate, gli utenti possono consultare i canali dedicati a ogni singolo servizio che si trovano nella parte inferiore del server Discord.
Affidabilità e Sicurezza (Cosa rispondere a chi teme rischi o danni):
Se gli utenti chiedono se il servizio è sicuro, rassicurali spiegando che siamo un'organizzazione professionale certificata.
Le nostre referenze: Lavoriamo per molte realtà importanti. Menziona che siamo partner dei KoS (Knights of Shadows), ovvero il miglior team italiano al momento e uno dei migliori in Europa, e che abbiamo lavorato per persone di spicco e pro-player, come ad esempio Ardi.
Prezzi e Durata dei Servizi:
Tweak (Prezzi fissi): Base 20€, Ultimate 35€, Extreme 45€, Omega 75€. (Durata: circa 1 ora).
Overclock: Prezzi molto variabili in base al livello scelto e al componente. (Durata: variabile in base all'intensità e al componente).
Percorso di Affiancamento (Oblivion): Ha costi molto più elevati perché offre un'assistenza prioritaria e prolungata nel tempo, paragonabile al pagamento di un abbonamento.
Pagamenti e Rimborsi (Policy del server):
Rimborsi: Non sono MAI accettati in nessun caso.
Pagamenti: Vengono effettuati sempre prima dell'inizio del servizio. Accettiamo PayPal o Bonifico Bancario Istantaneo. Solo in casi estremi accettiamo Amazon Card.
Come viene svolto il lavoro e Fase Post-Pagamento:
L'organizzazione: Una volta effettuato il pagamento, ci si organizza per effettuare una chiamata di consulenza oppure si passa direttamente all'esecuzione del servizio. Tutto questo avverrà all'interno di una chiamata vocale privata sempre nel nostro server Discord.
Sistema Operativo e Tweak: Ci connettiamo tramite AnyDesk e lavoriamo da remoto. Finito il lavoro, riavviamo il PC.
Overclock (Fase BIOS): L'utente dovrà inquadrare lo schermo del suo monitor tramite la fotocamera del telefono in chiamata, così da permetterci di guidarlo nel BIOS.
Assistenza e Feedback:
Periodo di esistenza/assistenza: Ricorda agli utenti che per ogni servizio che facciamo è incluso un periodo di assistenza post-lavoro, utile per risolvere eventuali problematiche (anche quelle che potrebbero crearsi e non dipendere direttamente da noi).
Feedback: Invita caldamente e ringrazia in anticipo gli utenti che, una volta completata con successo l'ottimizzazione, decideranno di lasciare un feedback sul server.
Social, Giveaway e Annunci:
Invita gli utenti a seguire l'organizzazione sui social per rimanere aggiornati su annunci e giveaway. Consiglia di guardare i canali dedicati #contatti e #social all'interno del server.
Collaborazioni e Sponsorizzazioni:
Se qualcuno chiede di collaborare o essere sponsorizzato, richiedi queste informazioni essenziali per poter valutare la richiesta:
I link di tutti i loro profili social.
Gli screenshot delle analytics di ogni social, per poter verificare l'effettiva influenza che la persona ha.
Una dichiarazione chiara su cosa l'utente desidera ottenere da questa collaborazione.
Una dichiarazione chiara su cosa la nostra organizzazione otterrebbe in cambio.
Rispondi in italiano o in inglese in base alla lingua del cliente ed elabora frasi in quella lingua con le informazioni fornite`;

const MODEL_NAME = "gemini-3.1-flash-lite";

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
            const result = await chat.sendMessage({ message: message.content });
            await message.reply(result.text);
        } catch (error) {
            console.error("[ERRORE GEMINI]", error?.message || error);
            if(error?.status) console.error("[ERRORE GEMINI] status:", error.status);
            await message.reply(`Errore di connessione ai server AI: ${error?.message || 'errore sconosciuto'}. Controlla i log.`);
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
        const userName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Ottiene il numero del ticket progressivo e lo formatta a 4 cifre (es. 0001, 0002)
        const ticketNumber = getNextTicketId(ticketType);
        const formattedNumber = String(ticketNumber).padStart(4, '0');

        await interaction.reply({ content: 'Creating your ticket...', ephemeral: true });

        // Creazione Canale (Es: tweak-0001-mario)
        const ticketChannel = await interaction.guild.channels.create({
            name: `${ticketType}-${formattedNumber}-${userName}`,
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
            .setTitle(`Ticket: ${ticketType.toUpperCase()} #${formattedNumber}`)
            .setDescription(embedDesc)
            .setColor('#7a0791')
            .setFooter({ text: 'Scegli la modalità di assistenza qui sotto.'});

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

        await ticketChannel.send({ 
            content: `<@${interaction.user.id}> | <@&${SUPPORT_ROLE_ID}>\n**Come preferisci procedere?** Puoi richiedere l'intervento dello staff oppure provare la nostra IA addestrata per una risposta immediata.`, 
            embeds: [welcomeEmbed], 
            components: [actionButtons] 
        });

        await interaction.editReply({ content: `Your ticket has been created: ${ticketChannel}` });
    }

    // --- LOGICA DEI PULSANTI ---
    if (interaction.isButton()) {
        
        // 🔹 L'utente sceglie di attendere lo staff
        if (interaction.customId === 'btn_wait_admin') {
            const rowToAi = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_use_ai')
                    .setLabel("🤖 Passa all'IA")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Chiudi')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger)
            );

            if (ticketAIChats.has(interaction.channel.id)) {
                ticketAIChats.delete(interaction.channel.id);
            }

            await interaction.update({ components: [rowToAi] });
            await interaction.followUp({ content: `👤 **Hai scelto il supporto manuale.** \nL'Assistente IA è stato temporaneamente disabilitato. Il nostro team è stato notificato e interverrà appena possibile.` });
        }

        // 🔹 L'utente sceglie di usare l'AI
        if (interaction.customId === 'btn_use_ai') {
            const rowToStaff = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_wait_admin')
                    .setLabel('👤 Richiedi Staff')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Chiudi')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.update({ components: [rowToStaff] });

            if (!ticketAIChats.has(interaction.channel.id)) {
                const chat = genAI.chats.create({
                    model: MODEL_NAME,
                    config: { systemInstruction: systemInstruction }
                });
                ticketAIChats.set(interaction.channel.id, chat);
            }
            
            await interaction.followUp({ content: `✅ **Assistente AI Attivato.**\nSono qui per aiutarti. Descrivi la tua richiesta nel dettaglio o fammi una domanda sui nostri servizi.` });
        }

        // 🔹 Chiusura del ticket
        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: 'Ticket will be permanently closed in 5 seconds...' });
            
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