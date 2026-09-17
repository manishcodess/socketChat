const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers for MongoDB Atlas SRV record resolution
try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (dnsErr) {
    console.warn('! DNS custom server set warning:', dnsErr.message);
}

const connectDB = async () => {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
        console.warn('! MONGODB_URI not found in environment. Database persistence disabled.');
        return;
    }

    try {
        const conn = await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 10000,
        });
        console.log(`✓ MongoDB Connected: ${conn.connection.host} (DB: ${conn.connection.name})`);
    } catch (err) {
        console.error('✗ MongoDB Connection Error:', err.message);
    }
};

module.exports = connectDB;
