const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const getQuotedImageMessage = (msg) => {
    const quoted = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return null;
    return quoted.imageMessage || null;
};

const getImageMessage = (msg) => msg?.message?.imageMessage || null;

const downloadImageBuffer = async (imageMessage) => {
    const stream = await downloadContentFromMessage(imageMessage, 'image');
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

const ONLINE_STATES = new Set(['available', 'composing', 'recording']);

const extractPresenceState = (presence) => {
    if (!presence) return null;
    if (typeof presence === 'string') return presence;
    return (
        presence.lastKnownPresence ||
        presence.presence ||
        presence.state ||
        presence.type ||
        null
    );
};

const fetchPresenceSafe = async (sock, jid) => {
    try {
        const res = await sock.fetchPresenceUpdate(jid);
        if (!res) return null;
        if (res.presence) return res.presence;
        if (res[jid]) return res[jid];
        return res;
    } catch (_) {
        return null;
    }
};

function attachHelpers(sock) {
	sock.respond = async (text) => {
        msg= sock.msg;
		if (!msg?.key?.remoteJid) return;
		return sock.sendMessage(msg.key.remoteJid, { text });
	};
    sock.reply = async (text) => {
        msg = sock.msg;
        if (!msg?.key?.remoteJid) return;
        const quoted = msg.key.id ? msg : undefined;
        return sock.sendMessage(msg.key.remoteJid, { text }, { quoted });
    };
    sock.react = async (emoji) => {
        msg = sock.msg;
        if (!msg?.key?.remoteJid) return;
        return sock.sendMessage(msg.key.remoteJid, {
            react: {
                text: emoji,
                key: msg.key,
            },
        });
    };
    sock.pin=async (key, type=1, time=604800) => {
        const jid = sock.msg?.key?.remoteJid;
        if (!jid) return;
        return sock.sendMessage(jid, { pin: { key, type, time } });
    };
    sock.unpin=async (key) => {
        const jid = sock.msg?.key?.remoteJid;
        if (!jid) return;
        return sock.sendMessage(jid, { pin: { key, type: 2 } });
    };
    sock.getString = (key, fallback) => getString(key, fallback, sock.userLanguage || sock.settings?.language);

    sock.buildMenuText = (title, sections, prefix) => {
        const menuPrefix = typeof prefix === 'string' && prefix.length ? prefix : '.';
        const style = sock.settings?.menuStyle || {};
        const header = style.header || '┏━━━━━━━━━━━━';
        const sectionPrefix = style.section || '┣━';
        const itemPrefix = style.item || '┃';
        const footer = style.footer || '┗━━━━━━━━━━━━';
        const titleEmoji = style.titleEmoji || '📚';
        const sectionEmoji = style.sectionEmoji || '📌';
        const itemEmoji = style.itemEmoji || '➡️';
        const lines = [`${header} ${titleEmoji} ${title}`];

        sections.forEach((section) => {
            lines.push(`${sectionPrefix} ${sectionEmoji} ${section.title}`);
            section.commands.forEach((cmd) => {
                lines.push(`${itemPrefix} ${itemEmoji} ${menuPrefix}${cmd}`);
            });
        });

        if (lines.length === 1) {
            const noCommands = sock.getString?.('messages.menu.noCommands', 'No commands found.') || 'No commands found.';
            lines.push(`${itemPrefix} ${itemEmoji} ${noCommands}`);
        }

        lines.push(footer);
        return lines.join('\n');
    };
}

module.exports = {
	attachHelpers,
    getQuotedImageMessage,
    getImageMessage,
    downloadImageBuffer,
    ONLINE_STATES,
    extractPresenceState,
    fetchPresenceSafe,
};
