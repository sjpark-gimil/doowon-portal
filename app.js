require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const defaults = {
    cbApiUrl: process.env.CB_BASE_URL || '',
    sessionSecret: process.env.SESSION_SECRET || 'default-secret',
};

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';
const corsOptions = { 
    origin: '*', 
    methods: ['GET', 'PUT', 'POST', 'DELETE'], 
    allowedHeaders: ['Content-Type', 'Authorization', 'accept'],
    credentials: true
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors(corsOptions));
app.use(session({  
    secret: defaults.sessionSecret,  
    resave: false,  
    saveUninitialized: false,
    cookie: {
        secure: false, 
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

console.log('Starting Doowon Portal application');
startApp();

function startApp() {
    try {
        const server = app.listen(PORT, HOST, () => {
            console.log(`Server running on port ${PORT} on ${HOST} (all interfaces)`);
        }).on('error', (err) => {
            console.error('Server error:', err.message);
            console.log('Trying to restart server in 10 seconds...');
            setTimeout(() => {
                startApp();
            }, 10000);
        });
        
        return server;
    } catch (error) {
        console.error('Error starting server:', error);
        console.log('Trying to restart server in 10 seconds...');
        setTimeout(() => {
            startApp();
        }, 10000);
    }
}

function requireAuth(req, res, next) {
    if (req.session && req.session.auth) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) { 
        return res.render('login', { 
            error: 'Username and password are required',
            serverUrl: defaults.cbApiUrl
        }); 
    }

    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    req.session.auth = auth;
    req.session.username = username;
    req.session.save((err) => {
        if (err) {
            console.error('Session save error:', err);
            return res.render('login', { 
                error: 'Session error occurred',
                serverUrl: defaults.cbApiUrl
            });
        }
        res.redirect('/');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) { console.error('Error destroying session:', err); }
        res.redirect('/login');
    });
});

app.get('/api/debug/ping', async (req, res) => {
    try {
        const pingUrl = `${defaults.cbApiUrl}/ping`;
        console.log('Pinging Codebeamer at:', pingUrl);
        
        const response = await axios.get(pingUrl, {
            timeout: 5000,
            validateStatus: function (status) {
                return status < 500;
            }
        });

        res.json({
            success: true,
            url: pingUrl,
            status: response.status,
            message: 'Codebeamer is reachable'
        });
    } catch (error) {
        res.json({
            success: false,
            url: pingUrl,
            error: error.message,
            message: 'Codebeamer is not reachable'
        });
    }
});

app.get('/api/assigned-to-me', requireAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        // Get user ID from session or username
        const username = req.session.username;
        
        // For now, we'll return mock data since we need the actual Codebeamer project/tracker configuration
        // This will be replaced with actual API calls when Codebeamer configuration is provided
        const mockAssignedItems = [
            {
                id: 1,
                title: "2024년 1월 1주차 주간보고 검토",
                type: "weekly-report",
                status: "pending",
                dueDate: "2024-01-15",
                priority: "high",
                assigner: "김과장"
            },
            {
                id: 2,
                title: "서울 고객사 방문 출장보고 승인",
                type: "travel-report", 
                status: "in-progress",
                dueDate: "2024-01-20",
                priority: "medium",
                assigner: "이부장"
            },
            {
                id: 3,
                title: "신규 노트북 배정 처리",
                type: "hardware",
                status: "pending",
                dueDate: "2024-01-25",
                priority: "low",
                assigner: "박팀장"
            },
            {
                id: 4,
                title: "부산 공장 점검 보고서 검토",
                type: "weekly-report",
                status: "pending",
                dueDate: "2024-01-18",
                priority: "high",
                assigner: "최부장"
            },
            {
                id: 5,
                title: "도쿄 출장보고 승인",
                type: "travel-report",
                status: "in-progress",
                dueDate: "2024-01-22",
                priority: "medium",
                assigner: "정팀장"
            },
            {
                id: 6,
                title: "모니터 교체 요청 처리",
                type: "hardware",
                status: "pending",
                dueDate: "2024-01-28",
                priority: "low",
                assigner: "한과장"
            },
            {
                id: 7,
                title: "월간 실적 보고서 검토",
                type: "weekly-report",
                status: "completed",
                dueDate: "2024-01-10",
                priority: "high",
                assigner: "김부장"
            },
            {
                id: 8,
                title: "베트남 출장보고 승인",
                type: "travel-report",
                status: "pending",
                dueDate: "2024-01-30",
                priority: "medium",
                assigner: "이부장"
            },
            {
                id: 9,
                title: "프린터 수리 요청 처리",
                type: "hardware",
                status: "in-progress",
                dueDate: "2024-01-26",
                priority: "low",
                assigner: "박팀장"
            },
            {
                id: 10,
                title: "분기별 보고서 검토",
                type: "weekly-report",
                status: "pending",
                dueDate: "2024-02-05",
                priority: "high",
                assigner: "최부장"
            }
        ];

        // Limit to first 5 items for display, but return total count
        const limitedItems = mockAssignedItems.slice(0, 5);

        res.json({
            success: true,
            items: limitedItems,
            total: mockAssignedItems.length,
            hasMore: mockAssignedItems.length > 5
        });

    } catch (error) {
        console.error('Error fetching assigned items:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch assigned items: ' + error.message 
        });
    }
});

app.get('/', requireAuth, (req, res) => {
    res.render('dashboard', {
        currentPath: '/',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || ''
    });
});

// Portal Routes
app.get('/weekly-reports', requireAuth, (req, res) => {
    res.render('weekly-reports', {
        currentPath: '/weekly-reports',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || ''
    });
});

app.get('/travel-reports', requireAuth, (req, res) => {
    res.render('travel-reports', {
        currentPath: '/travel-reports',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || ''
    });
});

app.get('/hardware-management', requireAuth, (req, res) => {
    res.render('hardware-management', {
        currentPath: '/hardware-management',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || ''
    });
});

app.get('/api/codebeamer/projects', requireAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const codebeamerUrl = `${defaults.cbApiUrl}/api/v3/projects`;
        console.log('Fetching projects from:', codebeamerUrl);
        console.log('Using auth:', req.session.auth);
        console.log('Username:', req.session.username);
        
        const response = await axios.get(codebeamerUrl, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000,
            validateStatus: function (status) {
                return status < 500; 
            }
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (response.status === 401) {
            console.error('Authentication failed - 401 Unauthorized');
            return res.status(401).json({ 
                error: 'Authentication failed with external Codebeamer instance',
                details: 'Please check if the external IP requires different authentication or API version'
            });
        }

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching projects:', error.message);
        if (error.response) {
            console.error('Error response status:', error.response.status);
            console.error('Error response data:', error.response.data);
        }
        res.status(500).json({ error: 'Failed to fetch projects: ' + error.message });
    }
});

app.get('/api/codebeamer/projects/:projectId/trackers', requireAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { projectId } = req.params;
        const codebeamerUrl = `${defaults.cbApiUrl}/api/v3/projects/${projectId}/trackers`;
        
        const response = await axios.get(codebeamerUrl, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching trackers:', error.message);
        res.status(500).json({ error: 'Failed to fetch trackers' });
    }
});

app.get('/api/codebeamer/trackers/:trackerId/items', requireAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { trackerId } = req.params;
        const { maxItems } = req.query;
        const pageSize = 25;
        let allItems = [];
        let currentPage = 1;
        let hasMorePages = true;

        while (hasMorePages) {
            const codebeamerUrl = `${defaults.cbApiUrl}/api/v3/trackers/${trackerId}/items?page=${currentPage}&pageSize=${pageSize}`;
            
            console.log(`Fetching page ${currentPage} from: ${codebeamerUrl}`);
            
            try {
                const response = await axios.get(codebeamerUrl, {
                    headers: {
                        'Authorization': `Basic ${req.session.auth}`,
                        'Content-Type': 'application/json',
                        'accept': 'application/json'
                    }
                });

                const responseData = response.data;
                let pageItems = [];

                if (Array.isArray(responseData)) {
                    pageItems = responseData;
                } else if (responseData.itemRefs && Array.isArray(responseData.itemRefs)) {
                    pageItems = responseData.itemRefs;
                } else if (responseData.items && Array.isArray(responseData.items)) {
                    pageItems = responseData.items;
                } else if (responseData.data && Array.isArray(responseData.data)) {
                    pageItems = responseData.data;
                }

                allItems = allItems.concat(pageItems);
                
                hasMorePages = pageItems.length === pageSize;
                currentPage++;
                
                if (maxItems && allItems.length >= parseInt(maxItems)) {
                    console.log(`Reached maximum items limit (${maxItems}), stopping pagination`);
                    allItems = allItems.slice(0, parseInt(maxItems));
                    break;
                }
                
                if (currentPage > 100) {
                    console.warn('Reached maximum page limit (100), stopping pagination');
                    break;
                }

                if (hasMorePages) {
                    console.log(`Waiting 1 second before fetching next page...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                if (error.response && error.response.status === 429) {
                    console.log('Rate limit hit, waiting 5 seconds before retrying...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                } else {
                    throw error;
                }
            }
        }

        console.log(`Fetched ${allItems.length} total items across ${currentPage - 1} pages`);
        res.json(allItems);
    } catch (error) {
        console.error('Error fetching items:', error.message);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});

