require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const defaults = {
    cbApiUrl: process.env.CB_BASE_URL || 'http://codebeamer.mdsit.co.kr:8080/cb',
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

function requireAdminAuth(req, res, next) {
    if (req.session && req.session.adminAuth) {
        next();
    } else {
        res.redirect('/admin/login');
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
    const pingUrl = `${defaults.cbApiUrl}/ping`;
    
    try {
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
        const username = req.session.username;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 25;
        
        console.log('Fetching assigned items for user:', username, 'page:', page, 'pageSize:', pageSize);
        
        // Use the correct Codebeamer API endpoint for assigned items
        const queryString = `assignedTo IN ('${username}')`;
        const apiUrl = `${defaults.cbApiUrl}/api/v3/items/query?page=${page}&pageSize=${pageSize}&queryString=${encodeURIComponent(queryString)}`;
        
        console.log('API URL:', apiUrl);
        
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            timeout: 10000
        });

        console.log('Response status:', response.status);
        console.log('Response data structure:', {
            page: response.data.page,
            pageSize: response.data.pageSize,
            total: response.data.total,
            itemsCount: response.data.items ? response.data.items.length : 0
        });

        if (response.data && response.data.items) {
            const assignedItems = response.data.items.map(item => ({
                id: item.id,
                name: item.name || 'Untitled',
                status: item.status?.name || 'Unset',
                submittedAt: item.createdAt || item.submittedAt,
                submittedBy: item.createdBy?.displayName || item.createdBy?.name || 'Unknown',
                modifiedAt: item.modifiedAt,
                modifiedBy: item.modifiedBy?.displayName || item.modifiedBy?.name || 'Unknown',
                tracker: item.tracker?.name || 'Unknown',
                typeName: item.typeName || 'Unknown'
            }));

            res.json({
                success: true,
                items: assignedItems,
                page: response.data.page,
                pageSize: response.data.pageSize,
                total: response.data.total,
                hasMore: response.data.page * response.data.pageSize < response.data.total,
                source: 'codebeamer'
            });
        } else {
            console.log('No assigned items found, returning mock data');
            const mockAssignedItems = [
                {
                    id: 1,
                    name: "2024년 1월 1주차 주간보고 검토",
                    status: "Pending",
                    submittedAt: "2024-01-08T09:00:00.000Z",
                    submittedBy: "김과장",
                    modifiedAt: "2024-01-08T09:00:00.000Z",
                    modifiedBy: "김과장",
                    tracker: "Weekly Reports",
                    typeName: "Report"
                },
                {
                    id: 2,
                    name: "서울 고객사 방문 출장보고 승인",
                    status: "In Progress",
                    submittedAt: "2024-01-10T14:30:00.000Z",
                    submittedBy: "이부장",
                    modifiedAt: "2024-01-10T14:30:00.000Z",
                    modifiedBy: "이부장",
                    tracker: "Travel Reports",
                    typeName: "Report"
                },
                {
                    id: 3,
                    name: "신규 노트북 배정 처리",
                    status: "Pending",
                    submittedAt: "2024-01-12T11:15:00.000Z",
                    submittedBy: "박팀장",
                    modifiedAt: "2024-01-12T11:15:00.000Z",
                    modifiedBy: "박팀장",
                    tracker: "Hardware Management",
                    typeName: "Task"
                }
            ];

            res.json({
                success: true,
                items: mockAssignedItems,
                page: 1,
                pageSize: 25,
                total: mockAssignedItems.length,
                hasMore: false,
                source: 'mock'
            });
        }

    } catch (error) {
        console.error('Error fetching assigned items:', error.message);
        if (error.response) {
            console.error('Error response status:', error.response.status);
            console.error('Error response data:', error.response.data);
        }
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

app.get('/weekly-reports', requireAuth, (req, res) => {
    res.render('weekly-reports', {
        currentPath: '/weekly-reports',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || ''
    });
});

app.get('/weekly-reports/dynamic', requireAuth, (req, res) => {
    res.render('weekly-reports-dynamic', {
        currentPath: '/weekly-reports/dynamic',
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

app.get('/equipment-management', requireAuth, (req, res) => {
    res.render('equipment-management', {
        currentPath: '/equipment-management',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || ''
    });
});

app.get('/external-training', requireAuth, (req, res) => {
    res.render('external-training', {
        currentPath: '/external-training',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || ''
    });
});

app.get('/admin/login', (req, res) => {
    res.render('admin-login', { error: null });
});

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'sejin.park' && password === '1234') {
        req.session.adminAuth = true;
        req.session.adminUsername = username;
        req.session.save((err) => {
            if (err) {
                console.error('Admin session save error:', err);
                return res.render('admin-login', { 
                    error: 'Session error occurred'
                });
            }
            res.redirect('/admin');
        });
    } else {
        res.render('admin-login', { 
            error: 'Invalid admin credentials'
        });
    }
});

app.get('/admin', requireAdminAuth, (req, res) => {
    res.render('admin-dynamic', {
        currentPath: '/admin',
        username: req.session.adminUsername || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || ''
    });
});

app.get('/admin/logout', (req, res) => {
    req.session.adminAuth = false;
    req.session.adminUsername = null;
    req.session.save((err) => {
        if (err) { console.error('Error destroying admin session:', err); }
        res.redirect('/admin/login');
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

app.get('/api/admin/available-trackers', requireAdminAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { projectId } = req.query;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        const codebeamerUrl = `${defaults.cbApiUrl}/api/v3/projects/${projectId}/trackers`;
        console.log('Fetching trackers from:', codebeamerUrl);
        
        const response = await axios.get(codebeamerUrl, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            timeout: 10000
        });

        const trackers = response.data.map(tracker => ({
            id: tracker.id,
            name: tracker.name,
            description: tracker.description || '',
            key: tracker.key || '',
            projectId: tracker.projectId
        }));

        res.json({
            success: true,
            trackers: trackers
        });
    } catch (error) {
        console.error('Error fetching available trackers:', error.message);
        if (error.response) {
            console.error('Error response status:', error.response.status);
            console.error('Error response data:', error.response.data);
        }
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch trackers: ' + error.message 
        });
    }
});

app.get('/api/admin/tracker-configuration/:trackerId', requireAdminAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { trackerId } = req.params;
        const configUrl = `${defaults.cbApiUrl}/api/v3/tracker/${trackerId}/configuration`;
        console.log('Fetching tracker configuration from:', configUrl);
        
        const response = await axios.get(configUrl, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            timeout: 10000
        });

        res.json({
            success: true,
            configuration: response.data
        });
    } catch (error) {
        console.error('Error fetching tracker configuration:', error.message);
        if (error.response) {
            console.error('Error response status:', error.response.status);
            console.error('Error response data:', error.response.data);
        }
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch tracker configuration: ' + error.message 
        });
    }
});

app.post('/api/admin/create-tracker', requireAdminAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { projectId, trackerName, trackerKey, description, section } = req.body;
        
        if (!projectId || !trackerName || !trackerKey) {
            return res.status(400).json({
                success: false,
                error: 'Project ID, tracker name, and tracker key are required'
            });
        }

        const trackerData = {
            projectId: parseInt(projectId),
            name: trackerName,
            key: trackerKey,
            description: description || `Tracker for ${section} management`,
            color: "#007bff",
            defaultLayout: "TABLE",
            workflowIsActive: true,
            onlyWorkflowActionsCanCreateNewReferringItems: false,
            alwaysUseQuickTransitions: false,
            locked: false,
            hidden: false,
            showAncestorItems: false,
            showDescendantItems: false,
            sharedInWorkingSets: true,
            itemCountVisibility: true,
            referenceVisibility: true,
            recentReferringTrackersMenu: false
        };

        console.log('Creating new tracker:', trackerData);
        
        const createUrl = `${defaults.cbApiUrl}/api/v3/trackers`;
        const response = await axios.post(createUrl, trackerData, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            timeout: 30000
        });

        res.json({
            success: true,
            message: 'Tracker created successfully',
            tracker: {
                id: response.data.id,
                name: response.data.name,
                key: response.data.key,
                projectId: response.data.projectId
            }
        });
    } catch (error) {
        console.error('Error creating tracker:', error.message);
        if (error.response) {
            console.error('Error response status:', error.response.status);
            console.error('Error response data:', error.response.data);
        }
        res.status(500).json({
            success: false,
            error: 'Failed to create tracker: ' + error.message,
            details: error.response?.data || null
        });
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


app.get('/api/hardware', requireAuth, async (req, res) => {
    try {
        // Generate more mock data for testing pagination
        const mockHardware = [];
        const vehicleTypes = ['SW', 'OV1', 'HE1i', 'SX3', 'NQ6', 'LT2'];
        const changeTypes = ['H/W', 'S/W'];
        const statuses = ['Done', 'In progress', 'ToDo', 'To verify'];
        const changeReasons = ['성능 개선', '버그 수정', '신규 기능 추가', '보안 업데이트', '호환성 개선'];

        for (let i = 1; i <= 150; i++) {
            mockHardware.push({
                id: i,
                name: `하드웨어 컴포넌트 v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}`,
                description: `하드웨어 컴포넌트 ${i}번 설명`,
                custom_field_1000: vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)],
                custom_field_1001: changeTypes[Math.floor(Math.random() * changeTypes.length)],
                custom_field_10005: changeReasons[Math.floor(Math.random() * changeReasons.length)],
                custom_field_10006: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
                custom_field_3: `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}`,
                custom_field_10002: `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}`,
                status: statuses[Math.floor(Math.random() * statuses.length)]
            });
        }

        // Handle pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const search = req.query.search || '';
        const sortBy = req.query.sortBy || 'id';
        const sortOrder = req.query.sortOrder || 'asc';
        
        console.log('Hardware API called with params:', { page, limit, search, sortBy, sortOrder });

        // Filter items based on search
        let filteredItems = mockHardware;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredItems = mockHardware.filter(item => 
                item.name.toLowerCase().includes(searchLower) ||
                item.description.toLowerCase().includes(searchLower) ||
                item.custom_field_1000.toLowerCase().includes(searchLower) ||
                item.custom_field_1001.toLowerCase().includes(searchLower) ||
                item.custom_field_10005.toLowerCase().includes(searchLower) ||
                item.id.toString().includes(search)
            );
        }

        // Sort items
        filteredItems.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];
            
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            if (sortOrder === 'desc') {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            } else {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            }
        });

        // Calculate pagination
        const totalItems = filteredItems.length;
        const totalPages = Math.ceil(totalItems / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedItems = filteredItems.slice(startIndex, endIndex);

        const response = {
            success: true,
            items: paginatedItems,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        };
        
        console.log('Hardware API response:', {
            itemsCount: paginatedItems.length,
            pagination: response.pagination
        });
        
        res.json(response);
    } catch (error) {
        console.error('Error fetching hardware items:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hardware items'
        });
    }
});

app.post('/api/hardware', requireAuth, async (req, res) => {
    try {
        const hardwareData = req.body;
        console.log('Saving hardware:', hardwareData);
        
        res.json({
            success: true,
            message: 'Hardware saved successfully',
            id: Date.now()
        });
    } catch (error) {
        console.error('Error saving hardware:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save hardware'
        });
    }
});


app.delete('/api/hardware/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Deleting hardware item:', id);
        
        res.json({
            success: true,
            message: 'Hardware item deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting hardware item:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete hardware item'
        });
    }
});

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}




const FIELD_CONFIGS_FILE = path.join(__dirname, 'data', 'field-configs.json');


const DEFAULT_FIELD_CONFIGS = {
    'weekly-reports': [
        { id: 1, name: '보고서 제목', codebeamerId: 'name', type: 'string', required: true, readonly: true },
        { id: 2, name: '보고 주차', codebeamerId: 'custom_field_1', type: 'string', required: true, readonly: false },
        { id: 3, name: '작성일', codebeamerId: 'submittedAt', type: 'calendar', required: true, readonly: true },
        { id: 4, name: '사업부', codebeamerId: 'custom_field_2', type: 'string', required: false, readonly: false },
        { id: 5, name: '금주 주간보고', codebeamerId: 'custom_field_3', type: 'string', required: true, readonly: false },
        { id: 6, name: '차주 주간보고', codebeamerId: 'custom_field_4', type: 'string', required: false, readonly: false },
        { id: 7, name: '첨부파일', codebeamerId: 'attachments', type: 'string', required: false, readonly: true },
        { id: 8, name: '상태', codebeamerId: 'status', type: 'string', required: true, readonly: true },
        { id: 9, name: '우선순위', codebeamerId: 'custom_field_50', type: 'selector', required: false, readonly: false, options: ['높음', '보통', '낮음'] },
        { id: 10, name: '진행률', codebeamerId: 'custom_field_51', type: 'number', required: false, readonly: false }
    ],
    'travel-reports': [
        { id: 1, name: '보고서 제목', codebeamerId: 'name', type: 'string', required: true, readonly: true },
        { id: 2, name: '출장지', codebeamerId: 'custom_field_5', type: 'string', required: true, readonly: false },
        { id: 3, name: '출장 목적', codebeamerId: 'custom_field_6', type: 'string', required: true, readonly: false },
        { id: 4, name: '출발일', codebeamerId: 'custom_field_7', type: 'calendar', required: true, readonly: false },
        { id: 5, name: '귀환일', codebeamerId: 'custom_field_8', type: 'calendar', required: true, readonly: false },
        { id: 6, name: '동행자', codebeamerId: 'custom_field_9', type: 'string', required: false, readonly: false },
        { id: 7, name: '교통비', codebeamerId: 'custom_field_10', type: 'number', required: false, readonly: false },
        { id: 8, name: '숙박비', codebeamerId: 'custom_field_11', type: 'number', required: false, readonly: false },
        { id: 9, name: '식비', codebeamerId: 'custom_field_12', type: 'number', required: false, readonly: false },
        { id: 10, name: '기타 경비', codebeamerId: 'custom_field_13', type: 'number', required: false, readonly: false },
        { id: 11, name: '출장 내용', codebeamerId: 'description', type: 'string', required: true, readonly: false }
    ],
    'hardware-management': [
        { id: 1, name: '하드웨어명', codebeamerId: 'name', type: 'string', required: true, readonly: true },
        { id: 2, name: 'HW 버전', codebeamerId: 'custom_field_3', type: 'string', required: true, readonly: true },
        { id: 3, name: 'SW 버전', codebeamerId: 'custom_field_10002', type: 'string', required: false, readonly: true },
        { id: 4, name: '차종', codebeamerId: 'custom_field_1000', type: 'selector', required: true, readonly: true, options: ['SW', 'OV1', 'HE1i', 'SX3', 'NQ6', 'LT2'] },
        { id: 5, name: '변경사항', codebeamerId: 'custom_field_1001', type: 'selector', required: true, readonly: true, options: ['H/W', 'S/W'] },
        { id: 6, name: '변경 사유', codebeamerId: 'custom_field_10005', type: 'string', required: true, readonly: true },
        { id: 7, name: 'Release 일자', codebeamerId: 'custom_field_10006', type: 'calendar', required: false, readonly: true },
        { id: 8, name: '설명', codebeamerId: 'description', type: 'string', required: false, readonly: true },
        { id: 9, name: '상태', codebeamerId: 'status', type: 'string', required: true, readonly: true },
        { id: 10, name: '등록자', codebeamerId: 'submittedBy', type: 'string', required: true, readonly: true }
    ],
    'equipment-management': [
        { id: 1, name: '장비명', codebeamerId: 'name', type: 'string', required: true, readonly: true },
        { id: 2, name: '카테고리', codebeamerId: 'custom_field_14', type: 'string', required: true, readonly: false },
        { id: 3, name: '제조사', codebeamerId: 'custom_field_15', type: 'string', required: true, readonly: false },
        { id: 4, name: '모델명', codebeamerId: 'custom_field_16', type: 'string', required: true, readonly: false },
        { id: 5, name: '시리얼 번호', codebeamerId: 'custom_field_17', type: 'string', required: true, readonly: false },
        { id: 6, name: '구매일', codebeamerId: 'custom_field_18', type: 'calendar', required: false, readonly: false },
        { id: 7, name: '보증만료일', codebeamerId: 'custom_field_19', type: 'calendar', required: false, readonly: false },
        { id: 8, name: '설치위치', codebeamerId: 'custom_field_20', type: 'string', required: false, readonly: false },
        { id: 9, name: '담당자', codebeamerId: 'custom_field_21', type: 'string', required: false, readonly: false },
        { id: 10, name: '사양', codebeamerId: 'description', type: 'string', required: false, readonly: false },
        { id: 11, name: '비고', codebeamerId: 'custom_field_22', type: 'string', required: false, readonly: false }
    ],
    'external-training': [
        { id: 1, name: '교육명', codebeamerId: 'name', type: 'string', required: true, readonly: true },
        { id: 2, name: '교육기관', codebeamerId: 'custom_field_23', type: 'string', required: true, readonly: false },
        { id: 3, name: '교육유형', codebeamerId: 'custom_field_24', type: 'string', required: true, readonly: false },
        { id: 4, name: '교육시작일', codebeamerId: 'custom_field_25', type: 'calendar', required: true, readonly: false },
        { id: 5, name: '교육종료일', codebeamerId: 'custom_field_26', type: 'calendar', required: true, readonly: false },
        { id: 6, name: '교육장소', codebeamerId: 'custom_field_27', type: 'string', required: false, readonly: false },
        { id: 7, name: '참석자', codebeamerId: 'custom_field_28', type: 'string', required: true, readonly: false },
        { id: 8, name: '수강료', codebeamerId: 'custom_field_29', type: 'number', required: false, readonly: false },
        { id: 9, name: '숙박비', codebeamerId: 'custom_field_30', type: 'number', required: false, readonly: false },
        { id: 10, name: '교통비', codebeamerId: 'custom_field_31', type: 'number', required: false, readonly: false },
        { id: 11, name: '식비', codebeamerId: 'custom_field_32', type: 'number', required: false, readonly: false },
        { id: 12, name: '교육내용', codebeamerId: 'description', type: 'string', required: true, readonly: false },
        { id: 13, name: '기대효과', codebeamerId: 'custom_field_33', type: 'string', required: false, readonly: false }
    ]
};


function loadFieldConfigs() {
    try {
        if (fs.existsSync(FIELD_CONFIGS_FILE)) {
            const data = fs.readFileSync(FIELD_CONFIGS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading field configs:', error);
    }
    return { fieldConfigs: DEFAULT_FIELD_CONFIGS };
}


function saveFieldConfigs(fieldConfigs) {
    try {
        const data = { fieldConfigs, lastUpdated: new Date().toISOString() };
        fs.writeFileSync(FIELD_CONFIGS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving field configs:', error);
        return false;
    }
}

app.get('/api/admin/field-configs', requireAdminAuth, (req, res) => {
    try {
        const data = loadFieldConfigs();
        res.json({
            success: true,
            fieldConfigs: data.fieldConfigs
        });
    } catch (error) {
        console.error('Error getting field configs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load field configs: ' + error.message
        });
    }
});

app.post('/api/admin/field-configs', requireAdminAuth, (req, res) => {
    try {
        const { fieldConfigs } = req.body;
        
        if (!fieldConfigs || typeof fieldConfigs !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Field configurations object is required'
            });
        }

        if (saveFieldConfigs(fieldConfigs)) {
            res.json({
                success: true,
                message: 'Field configurations saved successfully',
                fieldConfigs: fieldConfigs
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to save field configurations'
            });
        }
    } catch (error) {
        console.error('Error saving field configs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save field configs: ' + error.message
        });
    }
});

app.get('/api/admin/field-configs/:section', requireAdminAuth, (req, res) => {
    try {
        const { section } = req.params;
        const data = loadFieldConfigs();
        
        if (!data.fieldConfigs[section]) {
            return res.status(404).json({
                success: false,
                error: 'Section not found'
            });
        }
        
        res.json({
            success: true,
            fieldConfigs: data.fieldConfigs[section]
        });
    } catch (error) {
        console.error('Error getting field configs for section:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load field configs for section: ' + error.message
        });
    }
});

app.get('/api/field-configs/:section', (req, res) => {
    try {
        const { section } = req.params;
        const data = loadFieldConfigs();
        
        if (!data.fieldConfigs[section]) {
            return res.status(404).json({
                success: false,
                error: 'Section not found'
            });
        }
        
        res.json({
            success: true,
            fieldConfigs: data.fieldConfigs[section]
        });
    } catch (error) {
        console.error('Error getting field configs for section:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load field configs for section: ' + error.message
        });
    }
});

app.get('/api/codebeamer/trackers/:trackerId/fields', requireAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { trackerId } = req.params;
        const codebeamerUrl = `${defaults.cbApiUrl}/api/v3/trackers/${trackerId}`;
        
        const response = await axios.get(codebeamerUrl, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        const fields = response.data.fieldDefinitions || [];
        const fieldDefinitions = fields.map(field => ({
            id: field.id,
            name: field.name,
            referenceId: field.referenceId,
            type: field.type,
            mandatory: field.mandatory,
            description: field.description
        }));

        res.json({
            success: true,
            fields: fieldDefinitions
        });
    } catch (error) {
        console.error('Error fetching tracker fields:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch tracker fields: ' + error.message 
        });
    }
});

app.post('/api/admin/test-field-mapping', requireAdminAuth, async (req, res) => {
    try {
        const { section, fieldConfigs, trackerId } = req.body;
        
        if (!section || !fieldConfigs) {
            return res.status(400).json({
                success: false,
                error: 'Section and field configurations are required'
            });
        }

        if (!trackerId) {
            return res.status(400).json({
                success: false,
                error: 'Tracker ID is required'
            });
        }

        try {
            const testUrl = `${defaults.cbApiUrl}/api/v3/trackers/${trackerId}`;
            const response = await axios.get(testUrl, {
                headers: {
                    'Authorization': `Basic ${req.session.auth}`,
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                },
                timeout: 10000
            });

            res.json({
                success: true,
                message: 'Field mapping test successful',
                trackerId: trackerId,
                fieldCount: fieldConfigs.length,
                trackerName: response.data.name || 'Unknown'
            });
        } catch (error) {
            res.json({
                success: false,
                error: 'Failed to connect to Codebeamer tracker: ' + error.message
            });
        }
    } catch (error) {
        console.error('Error testing field mapping:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test field mapping: ' + error.message
        });
    }
});

app.post('/api/admin/update-codebeamer-config', requireAdminAuth, async (req, res) => {
    try {
        const { section, fieldConfigs, trackerId, projectId } = req.body;
        
        if (!section || !fieldConfigs || !trackerId || !projectId) {
            return res.status(400).json({
                success: false,
                error: 'Section, field configurations, trackerId, and projectId are required'
            });
        }

        if (!req.session || !req.session.auth) {
            return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
        }

        const codebeamerConfig = await buildCodebeamerConfig(fieldConfigs, trackerId, projectId, req.session.auth);
        
        try {
            const configUrl = `${defaults.cbApiUrl}/api/v3/tracker/configuration`;
            console.log('Updating Codebeamer configuration:', configUrl);
            console.log('Configuration payload:', JSON.stringify(codebeamerConfig, null, 2));
            
            const response = await axios.post(configUrl, codebeamerConfig, {
                headers: {
                    'Authorization': `Basic ${req.session.auth}`,
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                },
                timeout: 30000
            });

            res.json({
                success: true,
                message: 'Codebeamer configuration updated successfully',
                trackerId: trackerId,
                fieldCount: fieldConfigs.length,
                response: response.data
            });
        } catch (error) {
            console.error('Error updating Codebeamer configuration:', error);
            if (error.response) {
                console.error('Error response status:', error.response.status);
                console.error('Error response data:', error.response.data);
            }
            res.status(500).json({
                success: false,
                error: 'Failed to update Codebeamer configuration: ' + error.message,
                details: error.response?.data || null
            });
        }
    } catch (error) {
        console.error('Error in update-codebeamer-config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update Codebeamer configuration: ' + error.message
        });
    }
});

async function buildCodebeamerConfig(fieldConfigs, trackerId, projectId, auth) {
    const issueTypeId = 1;
    const position = 100;
    
    // First, try to get existing tracker configuration to preserve existing fields
    let existingConfig = null;
    try {
        const configUrl = `${defaults.cbApiUrl}/api/v3/tracker/${trackerId}/configuration`;
        const response = await axios.get(configUrl, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            timeout: 10000
        });
        existingConfig = response.data;
        console.log('Retrieved existing configuration with', existingConfig.fields?.length || 0, 'fields');
    } catch (error) {
        console.log('Could not retrieve existing configuration, creating new one');
    }

    // Start with existing fields or empty array
    const existingFields = existingConfig?.fields || [];
    const newFields = [];
    
    // Process new field configurations
    fieldConfigs.forEach((field, index) => {
        const referenceId = field.codebeamerId ? parseInt(field.codebeamerId.replace('custom_field_', '')) : (position + index + 1000);
        
        // Check if field already exists
        const existingField = existingFields.find(f => f.referenceId === referenceId);
        
        if (existingField) {
            // Update existing field without changing type
            const updatedField = {
                ...existingField,
                label: field.name,
                mandatory: field.required || false,
                hidden: false,
                listable: true
            };
            
            // Only update choice options if it's a selector field and type matches
            if (field.type === 'selector' && field.options && field.options.length > 0 && existingField.typeId === 6) {
                updatedField.choiceOptionSetting = {
                    type: "CHOICE_OPTIONS",
                    choiceOptions: field.options.map((option, optIndex) => ({
                        id: optIndex + 1,
                        name: option
                    }))
                };
            }
            
            newFields.push(updatedField);
        } else {
            // Create new field
            const fieldConfig = {
                referenceId: referenceId,
                typeId: getCodebeamerTypeId(field.type),
                position: position + index,
                label: field.name,
                hidden: false,
                listable: true,
                mandatory: field.required || false,
                mandatoryExceptInStatus: [],
                multipleSelection: false,
                propagateSuspect: false,
                reversedSuspect: false,
                bidirectionalSuspect: false,
                propagateDependencies: false,
                omitSuspectedWhenChange: false,
                omitMerge: false,
                newLine: false,
                permission: {
                    type: "UNRESTRICTED"
                },
                computedFieldReferences: []
            };

            if (field.type === 'selector' && field.options && field.options.length > 0) {
                fieldConfig.choiceOptionSetting = {
                    type: "CHOICE_OPTIONS",
                    choiceOptions: field.options.map((option, optIndex) => ({
                        id: optIndex + 1,
                        name: option
                    }))
                };
            }

            newFields.push(fieldConfig);
        }
    });

    // Preserve other existing fields that aren't being updated
    const updatedReferenceIds = newFields.map(f => f.referenceId);
    const preservedFields = existingFields.filter(f => !updatedReferenceIds.includes(f.referenceId));
    
    const allFields = [...preservedFields, ...newFields];

    return {
        basicInformation: {
            trackerId: parseInt(trackerId),
            projectId: parseInt(projectId),
            issueTypeId: issueTypeId,
            template: false,
            name: existingConfig?.basicInformation?.name || "Dynamic Tracker",
            key: existingConfig?.basicInformation?.key || "DYNAMIC",
            color: existingConfig?.basicInformation?.color || "",
            defaultLayout: existingConfig?.basicInformation?.defaultLayout || "TABLE",
            description: existingConfig?.basicInformation?.description || "Dynamic tracker created from admin configuration",
            workflowIsActive: existingConfig?.basicInformation?.workflowIsActive !== false,
            onlyWorkflowActionsCanCreateNewReferringItems: existingConfig?.basicInformation?.onlyWorkflowActionsCanCreateNewReferringItems || false,
            alwaysUseQuickTransitions: existingConfig?.basicInformation?.alwaysUseQuickTransitions || false,
            locked: existingConfig?.basicInformation?.locked || false,
            hidden: existingConfig?.basicInformation?.hidden || false,
            showAncestorItems: existingConfig?.basicInformation?.showAncestorItems || false,
            showDescendantItems: existingConfig?.basicInformation?.showDescendantItems || false,
            sharedInWorkingSets: existingConfig?.basicInformation?.sharedInWorkingSets !== false,
            itemCountVisibility: existingConfig?.basicInformation?.itemCountVisibility !== false,
            referenceVisibility: existingConfig?.basicInformation?.referenceVisibility !== false,
            recentReferringTrackersMenu: existingConfig?.basicInformation?.recentReferringTrackersMenu || false
        },
        fields: allFields
    };
}

function getCodebeamerTypeId(fieldType) {
    const typeMapping = {
        'string': 0,
        'number': 1,
        'calendar': 3,
        'selector': 6
    };
    return typeMapping[fieldType] || 0;
}


app.get('/api/equipment', requireAuth, async (req, res) => {
    try {
        const mockEquipment = [
            {
                id: 1,
                name: "생산라인 장비 A",
                category: "생산장비",
                manufacturer: "삼성전자",
                model: "SM-2000",
                serialNumber: "SN123456",
                purchaseDate: "2023-01-15",
                warrantyExpiry: "2025-01-15",
                location: "1층 생산라인",
                responsible: "김철수",
                specifications: "고성능 생산 장비",
                notes: "정기 점검 필요"
            }
        ];
        
        res.json({
            success: true,
            items: mockEquipment
        });
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch equipment data'
        });
    }
});

app.post('/api/equipment', requireAuth, async (req, res) => {
    try {
        const equipmentData = req.body;
        console.log('Saving equipment:', equipmentData);
        
        res.json({
            success: true,
            message: 'Equipment saved successfully',
            id: Date.now() // Mock ID
        });
    } catch (error) {
        console.error('Error saving equipment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save equipment'
        });
    }
});

app.get('/api/travel-reports', requireAuth, async (req, res) => {
    try {
        const mockReports = [
            {
                id: 1,
                title: "서울 출장 보고서",
                destination: "서울",
                purpose: "회의",
                startDate: "2024-01-15",
                endDate: "2024-01-17",
                participants: "김영희, 박민수",
                transportation: 50000,
                accommodation: 200000,
                meals: 100000,
                other: 30000,
                content: "고객사와의 중요한 회의 진행",
                status: "submitted"
            }
        ];
        
        res.json({
            success: true,
            items: mockReports
        });
    } catch (error) {
        console.error('Error fetching travel reports:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch travel reports'
        });
    }
});

app.post('/api/travel-reports', requireAuth, async (req, res) => {
    try {
        const reportData = req.body;
        console.log('Saving travel report:', reportData);
        
        res.json({
            success: true,
            message: 'Travel report saved successfully',
            id: Date.now()
        });
    } catch (error) {
        console.error('Error saving travel report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save travel report'
        });
    }
});

app.get('/api/external-training', requireAuth, async (req, res) => {
    try {
        const mockTrainings = [
            {
                id: 1,
                title: "AI 기술 교육",
                provider: "한국AI연구원",
                type: "기술교육",
                startDate: "2024-02-01",
                endDate: "2024-02-03",
                location: "서울 강남구",
                participants: "김개발, 이연구",
                tuition: 500000,
                accommodation: 200000,
                transportation: 100000,
                meals: 150000,
                content: "머신러닝 기초 및 실무 적용",
                outcome: "AI 기술 역량 향상",
                status: "approved"
            }
        ];
        
        res.json({
            success: true,
            items: mockTrainings
        });
    } catch (error) {
        console.error('Error fetching external training:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch external training data'
        });
    }
});

app.post('/api/external-training', requireAuth, async (req, res) => {
    try {
        const trainingData = req.body;
        
        console.log('Saving external training:', trainingData);
        
        res.json({
            success: true,
            message: 'External training saved successfully',
            id: Date.now()
        });
    } catch (error) {
        console.error('Error saving external training:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save external training'
        });
    }
});

app.get('/api/weekly-reports', requireAuth, async (req, res) => {
    try {
        const mockReports = [
            {
                id: 1,
                title: "2024년 1월 1주차 주간보고",
                week: "2024-W01",
                date: "2024-01-05",
                businessDivision: "기술개발부",
                thisWeekContent: "프로젝트 A 개발 진행",
                nextWeekContent: "프로젝트 A 테스트 및 배포",
                status: "submitted"
            }
        ];
        
        res.json({
            success: true,
            items: mockReports
        });
    } catch (error) {
        console.error('Error fetching weekly reports:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch weekly reports'
        });
    }
});

app.post('/api/weekly-reports', requireAuth, async (req, res) => {
    try {
        const reportData = req.body;
        console.log('Saving weekly report:', reportData);
        
        res.json({
            success: true,
            message: 'Weekly report saved successfully',
            id: Date.now()
        });
    } catch (error) {
        console.error('Error saving weekly report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save weekly report'
        });
    }
});

