export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    try {
        const response = await fetch(decodeURIComponent(url));

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch video' });
        }

        const contentType = response.headers.get('content-type') || 'video/mp4';
        const buffer = await response.arrayBuffer();

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'attachment; filename="ad-video.mp4"');
        res.send(Buffer.from(buffer));
    } catch (error) {
        console.error('Proxy download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
}
