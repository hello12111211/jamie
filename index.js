/*
index.js
*/

const express = require('express');
const fs = require('fs');
const path = require('path');

const {
    PUBLIC_DIR
} = require('./data');

const {
    registerResourceRoutes,
    setupMathRepo
} = require('./resource');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse raw request bodies for /api/resource
app.use(express.raw({
    type: '*/*',
    limit: '100mb'
}));

// Inject service worker registration into HTML files
app.use(async (req, res, next) => {
    if (req.method !== 'GET') return next();

    if (req.path.endsWith('.html') || req.path === '/') {
        const filePath = req.path === '/'
            ? path.join(PUBLIC_DIR, 'index.html')
            : path.join(PUBLIC_DIR, req.path);

        try {
            let html = await fs.promises.readFile(filePath, 'utf8');

            const inject =
                `<script>if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js');</script>`;

            html = html.includes('</head>')
                ? html.replace('</head>', inject + '</head>')
                : html + inject;

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(html);
        } catch {
            return next();
        }
    }

    next();
});

// Register API routes
registerResourceRoutes(app);

// Serve service worker directly
app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'sw.js'));
});

// Serve static files
app.use(express.static(PUBLIC_DIR));

// Serve math repository
app.use('/math', express.static(path.join(__dirname, '..', 'math')));

// Basic health endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).send('Not Found');
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Internal Server Error');
});

// Startup
(async () => {
    try {
        await setupMathRepo();

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Startup failed:', err);
        process.exit(1);
    }
})();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nShutting down...');
    process.exit(0);
});
