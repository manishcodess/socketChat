const { getImageKitClient, getPublicKey, getUrlEndpoint } = require('../config/imagekit');

// Upload file to ImageKit via backend
exports.uploadFile = async (req, res) => {
    try {
        const imagekit = getImageKitClient();
        let filePayload = null;
        let fileName = req.body.fileName || `chat_${Date.now()}_attachment`;

        if (req.file) {
            // Multipart file upload via multer
            filePayload = req.file.buffer.toString('base64');
            fileName = req.file.originalname || fileName;
        } else if (req.body.file) {
            // Base64 string payload
            filePayload = req.body.file;
        }

        if (!filePayload) {
            return res.status(400).json({ error: 'No file or image payload provided for upload.' });
        }

        // Upload to ImageKit
        const uploadResponse = await imagekit.upload({
            file: filePayload,
            fileName: fileName,
            folder: '/socketchat/attachments',
            useUniqueFileName: true
        });

        res.json({
            success: true,
            fileId: uploadResponse.fileId,
            name: uploadResponse.name,
            url: uploadResponse.url,
            thumbnailUrl: uploadResponse.thumbnailUrl || uploadResponse.url,
            fileType: uploadResponse.fileType || 'image'
        });
    } catch (err) {
        console.error('ImageKit upload error:', err);
        res.status(500).json({
            error: 'Failed to upload image to ImageKit',
            details: err.message
        });
    }
};

// Return ImageKit client authentication parameters for direct frontend uploads if needed
exports.getAuthParams = (req, res) => {
    try {
        const imagekit = getImageKitClient();
        const authParams = imagekit.getAuthenticationParameters();
        res.json({
            ...authParams,
            publicKey: getPublicKey(),
            urlEndpoint: getUrlEndpoint()
        });
    } catch (err) {
        console.error('Error generating ImageKit auth parameters:', err);
        res.status(500).json({ error: 'Failed to generate ImageKit auth params' });
    }
};
