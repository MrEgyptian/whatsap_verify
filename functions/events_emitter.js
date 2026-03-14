const fs = require('fs');
const path = require('path');
const AUTH_DIR = path.join(__dirname, '..', 'auth');

function extractMessageText(message) {
    return (
        message?.message?.conversation ||
        message?.message?.extendedTextMessage?.text ||
        message?.message?.imageMessage?.caption ||
        message?.message?.videoMessage?.caption ||
        ''
    );
}

function resolveIdToPhone(rawId) {
    if (!rawId) return undefined;

    const reverseMapPath = path.join(AUTH_DIR, `lid-mapping-${rawId}_reverse.json`);
    if (!fs.existsSync(reverseMapPath)) {
        return `+${rawId}`;
    }

    try {
        const mappedPhone = JSON.parse(fs.readFileSync(reverseMapPath, 'utf8'));
        if (typeof mappedPhone === 'string' && /^\d+$/.test(mappedPhone)) {
            return `+${mappedPhone}`;
        }
    } catch (_) {
        // Fall back to the raw id when mapping file content is invalid.
    }

    return `+${rawId}`;
}

function extractPhoneFromMessage(message) {
    const participant = message?.key?.participant || '';
    const remoteJid = message?.key?.remoteJid || '';
    const sourceJid = participant || remoteJid;
    const match = sourceJid.match(/^(\d+)(?::\d+)?@/);
    if (!match) return undefined;
    return resolveIdToPhone(match[1]);
}

async function matchEvent(text){
    const codeMatch = text.match(/(\d{6})/);
    if (codeMatch) {
        return { code: codeMatch[1] ,type:'verify'};
    }
    const commandMatch = text.match(/^\/(\w+)/);
    if (commandMatch) {
        return { command: commandMatch[1], type: 'command' };
    }
    return null;
}
async function emitEvents(sock) {
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        const message = messages[0];
        sock.msg = message;
        const msg_txt = extractMessageText(message);
        const eventData = await matchEvent(msg_txt);
        if (eventData) {
            if (eventData.type === 'verify') {
                eventData.phone = extractPhoneFromMessage(message);
            }
            console.log('Emitting event:', eventData.type, 'with data:', eventData);
            sock.ev.emit(eventData.type, eventData);
        }
    });
}
async function load_events(sock){
    const events_dir = path.join(__dirname,'..','events');
    const event_files = fs.readdirSync(events_dir).filter(file => file.endsWith('.js'));
    for (const file of event_files) {
         require(path.join(events_dir, file))(sock);
    }
}
module.exports = {
    emitEvents,
    EmitEvents: emitEvents,
    load_events
};