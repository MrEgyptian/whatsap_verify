const {
	default: makeWASocket,
	useMultiFileAuthState,
	fetchLatestBaileysVersion,
	DisconnectReason,
} = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');

async function startAuthSocket({ onReconnect } = {}) {
	const { state, saveCreds } = await useMultiFileAuthState('auth');
	const { version } = await fetchLatestBaileysVersion();

	const sock = makeWASocket({
		version,
		auth: state,
		logger: P({ level: 'silent' }),
	});

	sock.ev.on('creds.update', saveCreds);

	sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect, qr } = update;

		if (qr) {
			qrcode.generate(qr, { small: true });
		}

		if (connection === 'open') {
			console.log('WhatsApp connected');
		}

		if (connection === 'connecting') {
			console.log('WhatsApp connecting...');
		}

		if (connection === 'close') {
			console.log('WhatsApp disconnected');
			const shouldReconnect =
				lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
			if (shouldReconnect) {
				startAuthSocket({ onReconnect }).then((newSock) => {
					if (typeof onReconnect === 'function') {
						onReconnect(newSock);
					}
				});
			}
		}
	});

	return sock;
}

module.exports = {
	startAuthSocket,
};
