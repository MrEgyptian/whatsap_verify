const { verifyOTP } = require('../functions/database');
module.exports = (sock) => {
    sock.ev.on('verify', async (data) => {
        const { phone, code } = data;
        if (!phone || !code) {
            await sock.reply('Could not detect phone or code for verification. Send a 6-digit code from your number.');
            return;
        }
        const result = await verifyOTP(phone, code);

        const silentMessages = new Set([
            'Phone already verified',
            'No OTP request found',
        ]);

        if (silentMessages.has(result.message)) {
            console.log('Verification ignored:', result);
            return;
        }

        await sock.reply(result.message);
        console.log('Verification result:', result);
    });
}