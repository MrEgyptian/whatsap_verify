require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

function createPrismaClient() {
    const directUrl = process.env.DIRECT_DATABASE_URL;
    const databaseUrl = process.env.DATABASE_URL;
    const url = directUrl || databaseUrl;

    if (!url) {
        throw new Error('Missing database URL. Set DIRECT_DATABASE_URL or DATABASE_URL in .env');
    }

    // For Prisma Postgres/Accelerate URLs, PrismaClient expects accelerateUrl.
    if (url.startsWith('prisma+postgres://')) {
        return new PrismaClient({ accelerateUrl: url });
    }

    // For native Postgres URLs, Prisma 7 expects a driver adapter.
    const { PrismaPg } = require('@prisma/adapter-pg');
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5);

function getOtpExpiryDate() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + OTP_EXPIRY_MINUTES);
    return now;
}

async function createOrUpdateOTP(phone) {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await prisma.user.upsert({
        where: { phone },
        update: {},
        create: { phone, verified: false },
    });

    const otp = await prisma.otpCode.create({
        data: {
            phone,
            otpCode,
            expiresAt: getOtpExpiryDate(),
            used: false,
            attempts: 0,
            userId: user.id,
        },
    });

    await prisma.otpRequest.create({
        data: {
            phone,
            userId: user.id,
        },
    });

    // Keep backward-compatible payload shape for current callers.
    return {
        ...otp,
        code: otp.otpCode,
    };
}

async function verifyOTP(phone, code) {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return { success: false, message: 'No OTP request found' };
    if (user.verified) return { success: false, message: 'Phone already verified' };

    const now = new Date();
    const record = await prisma.otpCode.findFirst({
        where: {
            phone,
            used: false,
            expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
    });

    if (!record) {
        await prisma.verificationAttempt.create({
            data: {
                phone,
                attemptedCode: code,
                success: false,
                userId: user.id,
            },
        });
        return { success: false, message: 'No valid OTP found. Please request a new code' };
    }

    const isMatch = record.otpCode === code;

    await prisma.verificationAttempt.create({
        data: {
            phone,
            attemptedCode: code,
            success: isMatch,
            userId: user.id,
        },
    });

    if (isMatch) {
        await prisma.$transaction([
            prisma.otpCode.update({
                where: { id: record.id },
                data: { used: true },
            }),
            prisma.user.update({
                where: { id: user.id },
                data: { verified: true },
            }),
        ]);
        return { success: true, message: 'Phone verified successfully' };
    }

    await prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: record.attempts + 1 },
    });

    return { success: false, message: 'Invalid OTP code' };
}

async function userRegistered(phone) {
    const record = await prisma.user.findUnique({ where: { phone } });
    return record?.verified || false;
}

async function userExists(phone) {
    const record = await prisma.user.findUnique({ where: { phone } });
    return !!record;
}

module.exports = {
    createOrUpdateOTP,
    verifyOTP,
    userRegistered,
    userExists,
};