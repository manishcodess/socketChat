const ImageKit = require('imagekit');

let imagekit = null;

const getPublicKey = () => process.env.IMAGEKIT_PUBLIC_KEY || '';
const getPrivateKey = () => process.env.IMAGEKIT_PRIVATE_KEY || '';
const getUrlEndpoint = () => process.env.IMAGEKIT_URL_ENDPOINT || '';

const getImageKitClient = () => {
    if (!imagekit) {
        const publicKey = getPublicKey();
        const privateKey = getPrivateKey();
        const urlEndpoint = getUrlEndpoint();

        if (publicKey && privateKey && urlEndpoint) {
            try {
                imagekit = new ImageKit({
                    publicKey,
                    privateKey,
                    urlEndpoint
                });
                console.log('✓ ImageKit SDK initialized successfully.');
            } catch (err) {
                console.warn('! ImageKit initialization warning:', err.message);
            }
        }
    }
    return imagekit;
};

// Initialize immediately on module load
getImageKitClient();

module.exports = {
    getImageKitClient,
    getPublicKey,
    getUrlEndpoint
};

