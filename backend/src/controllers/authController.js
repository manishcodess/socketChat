const fs = require('fs');
const path = require('path');
const { initClerkClient } = require('../config/clerk');
const User = require('../models/User');

exports.getAuthConfig = (req, res) => {
    const pubKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
    const secKey = process.env.CLERK_SECRET_KEY || '';
    const isConfigured = Boolean(
        pubKey && 
        pubKey !== 'pk_test_placeholder' &&
        secKey &&
        secKey !== 'sk_test_placeholder'
    );

    res.json({
        publishableKey: pubKey,
        isConfigured: isConfigured,
        serverTime: new Date().toISOString()
    });
};

exports.saveAuthConfig = (req, res) => {
    const { publishableKey: newPubKey, secretKey: newSecKey } = req.body;
    if (!newPubKey || !newSecKey) {
        return res.status(400).json({ error: 'Both publishableKey and secretKey are required.' });
    }

    try {
        process.env.CLERK_PUBLISHABLE_KEY = newPubKey.trim();
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = newPubKey.trim();
        process.env.CLERK_SECRET_KEY = newSecKey.trim();

        // Update .env file in backend directory
        const envPath = path.resolve(__dirname, '../../.env');
        let currentEnv = '';
        if (fs.existsSync(envPath)) {
            currentEnv = fs.readFileSync(envPath, 'utf-8');
        }

        const lines = currentEnv.split('\n').filter(Boolean);
        const envMap = new Map();
        lines.forEach(l => {
            const [k, ...v] = l.split('=');
            if (k) envMap.set(k.trim(), v.join('=').trim());
        });

        envMap.set('CLERK_PUBLISHABLE_KEY', newPubKey.trim());
        envMap.set('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', newPubKey.trim());
        envMap.set('CLERK_SECRET_KEY', newSecKey.trim());

        const updatedEnv = Array.from(envMap.entries()).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
        fs.writeFileSync(envPath, updatedEnv, 'utf-8');

        // Reinitialize Clerk client
        initClerkClient();
        console.log('✓ Updated Clerk configuration and reinitialized client.');

        res.json({ success: true, message: 'Clerk configuration saved successfully!' });
    } catch (err) {
        console.error('Error saving Clerk config:', err);
        res.status(500).json({ error: 'Failed to save configuration.' });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const users = await User.find({}).sort({ updatedAt: -1 }).limit(100);
        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};
