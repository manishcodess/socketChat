const { createClerkClient } = require('@clerk/backend');

let clerkClient = null;

const initClerkClient = () => {
    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
    const secretKey = process.env.CLERK_SECRET_KEY || '';

    if (secretKey && secretKey !== 'sk_test_placeholder') {
        try {
            clerkClient = createClerkClient({ secretKey, publishableKey });
            console.log('✓ Clerk Backend Client initialized successfully.');
        } catch (err) {
            console.warn('! Clerk Backend Client initialization warning:', err.message);
        }
    } else {
        console.warn('! CLERK_SECRET_KEY not set in backend .env. Running in fallback mode.');
    }
    return clerkClient;
};

// Initialize immediately on module load
initClerkClient();

const getClerkClient = () => clerkClient;

module.exports = {
    initClerkClient,
    getClerkClient
};
