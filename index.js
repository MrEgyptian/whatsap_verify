const { startAuthSocket } = require('./functions/auth');
const { attachHelpers } = require('./functions/helpers');
const { emitEvents, load_events } = require('./functions/events_emitter');
const {createOrUpdateOTP, verifyOTP} = require('./functions/database');
process.on('uncaughtException', (err) => {
	console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
	console.error('Unhandled Rejection:', reason);
});

async function bindMessageHandler(sock) {
	// sock.settings = settings;
	attachHelpers(sock);
    const otp = await createOrUpdateOTP("+201150119895");
    console.log('Generated OTP:', otp);
 	emitEvents(sock);
	load_events(sock);
	console.log('Binding message handler', sock.message);
}


startAuthSocket({
	onReconnect: (newSock) => bindMessageHandler(newSock),
})
	.then((sock) => bindMessageHandler(sock))
	.catch((err) => console.error(err));
