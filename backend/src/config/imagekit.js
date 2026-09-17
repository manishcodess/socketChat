const ImageKit = require('imagekit');

let imagekit = null;

const getPublicKey = () => process.env.IMAGEKIT_PUBLIC_KEY || 'public_3NSKOeGZwb3WHqX39YYRP0shRa4=';
const getPrivateKey = () => process.env.IMAGEKIT_PRIVATE_KEY || 'private_oduvld3ueON3ypiQqFevvDirKe4=';
const getUrlEndpoint = () => process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/algoforge';

try {
    imagekit = new ImageKit({
        publicKey: getPublicKey(),
        privateKey: getPrivateKey(),
        urlEndpoint: getUrlEndpoint()
    });
    console.log('✓ ImageKit SDK initialized successfully.');
} catch (err) {
    console.warn('! ImageKit initialization warning:', err.message);
}

const getImageKitClient = () => {
    if (!imagekit) {
        imagekit = new ImageKit({
            publicKey: getPublicKey(),
            privateKey: getPrivateKey(),
            urlEndpoint: getUrlEndpoint()
        });
    }
    return imagekit;
};

module.exports = {
    getImageKitClient,
    getPublicKey,
    getUrlEndpoint
};
