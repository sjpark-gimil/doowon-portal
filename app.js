require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');

const defaults = {
    cbApiUrl: process.env.CB_BASE_URL || 'http://codebeamer.mdsit.co.kr:3008',
    sessionSecret: process.env.SESSION_SECRET || 'default-secret',
    fileUploaderUrl: process.env.FILE_UPLOADER_URL || 'http://codebeamer.mdsit.co.kr:3007',
    ganttChartUrl: process.env.GANTT_CHART_URL || 'http://codebeamer.mdsit.co.kr:3002',
};

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});

const app = express();
const PORT = 3001;
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
            res.json({
                success: true,
                items: [],
                page: 1,
                pageSize: 25,
                total: 0,
                hasMore: false,
                source: 'codebeamer'
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
    const data = loadFieldConfigs();
    const sectionTitles = data.sectionTitles || getDefaultSectionTitles();
    res.render('dashboard', {
        currentPath: '/',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || '',
        fileUploaderUrl: defaults.fileUploaderUrl,
        ganttChartUrl: defaults.ganttChartUrl,
        sectionTitles: sectionTitles
    });
});

app.get('/weekly-reports', requireAuth, (req, res) => {
    const data = loadFieldConfigs();
    const sectionTitles = data.sectionTitles || getDefaultSectionTitles();
    res.render('weekly-reports', {
        currentPath: '/weekly-reports',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || '',
        sectionTitles: sectionTitles,
        fileUploaderUrl: defaults.fileUploaderUrl,
        ganttChartUrl: defaults.ganttChartUrl
    });
});

app.get('/travel-reports', requireAuth, (req, res) => {
    const data = loadFieldConfigs();
    const sectionTitles = data.sectionTitles || getDefaultSectionTitles();
    res.render('travel-reports', {
        currentPath: '/travel-reports',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || '',
        sectionTitles: sectionTitles,
        fileUploaderUrl: defaults.fileUploaderUrl,
        ganttChartUrl: defaults.ganttChartUrl
    });
});

app.get('/hardware-management', requireAuth, (req, res) => {
    const data = loadFieldConfigs();
    const sectionTitles = data.sectionTitles || getDefaultSectionTitles();
    res.render('hardware-management', {
        currentPath: '/hardware-management',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || '',
        sectionTitles: sectionTitles,
        fileUploaderUrl: defaults.fileUploaderUrl,
        ganttChartUrl: defaults.ganttChartUrl
    });
});

app.get('/equipment-management', requireAuth, (req, res) => {
    const data = loadFieldConfigs();
    const sectionTitles = data.sectionTitles || getDefaultSectionTitles();
    res.render('equipment-management', {
        currentPath: '/equipment-management',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || '',
        sectionTitles: sectionTitles,
        fileUploaderUrl: defaults.fileUploaderUrl,
        ganttChartUrl: defaults.ganttChartUrl
    });
});

app.get('/external-training', requireAuth, (req, res) => {
    const data = loadFieldConfigs();
    const sectionTitles = data.sectionTitles || getDefaultSectionTitles();
    res.render('external-training', {
        currentPath: '/external-training',
        username: req.session.username || '',
        serverUrl: defaults.cbApiUrl,
        cbBaseUrl: process.env.CB_BASE_URL || '',
        sectionTitles: sectionTitles,
        fileUploaderUrl: defaults.fileUploaderUrl,
        ganttChartUrl: defaults.ganttChartUrl
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

app.get('/api/admin/tracker-types', requireAdminAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const trackerTypesUrl = `${defaults.cbApiUrl}/api/v3/trackerTypes`;
        console.log('Fetching tracker types from:', trackerTypesUrl);
        
        const response = await axios.get(trackerTypesUrl, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            timeout: 10000
        });

        const trackerTypes = response.data.map(type => ({
            id: type.id,
            name: type.name,
            description: type.description || ''
        }));

        res.json({
            success: true,
            trackerTypes: trackerTypes
        });
    } catch (error) {
        console.error('Error fetching tracker types:', error.message);
        if (error.response) {
            console.error('Error response status:', error.response.status);
            console.error('Error response data:', error.response.data);
        }
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch tracker types: ' + error.message 
        });
    }
});

app.post('/api/admin/create-tracker', requireAdminAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { projectId, trackerName, trackerKey, summary, description, section } = req.body;
        
        if (!projectId || !trackerName || !trackerKey) {
            return res.status(400).json({
                success: false,
                error: 'Project ID, tracker name, and tracker key are required'
            });
        }

        let trackerTypeId = 1;
        try {
            const trackerTypesUrl = `${defaults.cbApiUrl}/api/v3/trackerTypes`;
            const typesResponse = await axios.get(trackerTypesUrl, {
                headers: {
                    'Authorization': `Basic ${req.session.auth}`,
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                },
                timeout: 10000
            });
            
            if (typesResponse.data && typesResponse.data.length > 0) {
                trackerTypeId = typesResponse.data[0].id;
                console.log('Using tracker type ID:', trackerTypeId);
            }
        } catch (error) {
            console.log('Could not fetch tracker types, using default ID:', trackerTypeId);
        }

        const trackerData = {
            name: trackerName,
            description: description || `Tracker for ${section} management`,
            descriptionFormat: "PlainText",
            keyName: trackerKey,
            color: "#007bff",
            availableAsTemplate: false,
            defaultShowAncestorItems: false,
            defaultShowDescendantItems: false,
            hidden: false,
            onlyWorkflowCanCreateNewReferringItem: false,
            sharedInWorkingSet: true,
            usingQuickTransitions: false,
            usingWorkflow: true,
            project: {
                id: parseInt(projectId)
            },
            type: {
                id: trackerTypeId
            }
        };

        console.log('Creating new tracker:', trackerData);
        
        const createUrl = `${defaults.cbApiUrl}/api/v3/${projectId}/trackers`;
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

app.get('/api/codebeamer/items/:itemId', requireAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { itemId } = req.params;
        const itemUrl = `${defaults.cbApiUrl}/api/v3/items/${itemId}`;
        
        console.log(`Fetching item ${itemId} from: ${itemUrl}`);
        
        const response = await axios.get(itemUrl, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        console.log(`Successfully fetched item ${itemId}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching item:', error.message);
        res.status(500).json({ error: 'Failed to fetch item' });
    }
});

app.put('/api/codebeamer/items/:itemId/fields', requireAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { itemId } = req.params;
        const { fieldValues } = req.body;
        const updateUrl = `${defaults.cbApiUrl}/api/v3/items/${itemId}/fields`;
        
        console.log(`Updating item ${itemId} fields:`, fieldValues);
        
        const response = await axios.put(updateUrl, { fieldValues }, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        console.log(`Successfully updated item ${itemId} fields`);
        res.json({ success: true, message: 'Item fields updated successfully', data: response.data });
    } catch (error) {
        console.error('Error updating item fields:', error.message);
        res.status(500).json({ error: 'Failed to update item fields' });
    }
});

app.delete('/api/codebeamer/items/:itemId', requireAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { itemId } = req.params;
        const deleteUrl = `${defaults.cbApiUrl}/api/v3/items/${itemId}`;
        
        console.log(`Deleting item ${itemId} from: ${deleteUrl}`);
        
        const response = await axios.delete(deleteUrl, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        console.log(`Successfully deleted item ${itemId}`);
        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting item:', error.message);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

app.get('/api/codebeamer/trackers/:trackerId/items', requireAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { trackerId } = req.params;
        const { 
            maxItems, 
            includeFields, 
            page = 1, 
            pageSize = 25, 
            search,
            filters 
        } = req.query;
        
        const fieldParam = includeFields === 'true' ? '&fieldValueFormat=html' : '';
        const searchParam = search ? `&queryString=${encodeURIComponent(search)}` : '';
        
        let codebeamerUrl = `${defaults.cbApiUrl}/api/v3/trackers/${trackerId}/items?page=${page}&pageSize=${pageSize}${fieldParam}${searchParam}`;
        
        console.log(`Fetching items from: ${codebeamerUrl}`);
        
        const response = await axios.get(codebeamerUrl, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        const responseData = response.data;
        let items = [];

        if (Array.isArray(responseData)) {
            items = responseData;
        } else if (responseData.itemRefs && Array.isArray(responseData.itemRefs)) {
            items = responseData.itemRefs;
        } else if (responseData.items && Array.isArray(responseData.items)) {
            items = responseData.items;
        } else if (responseData.data && Array.isArray(responseData.data)) {
            items = responseData.data;
        }

        if (includeFields === 'true' && items.length > 0) {
            console.log(`Fetching detailed data for ${items.length} items using CBQL query...`);
            
            try {
                const itemIds = items.map(item => item.id);
                const itemIdConditions = itemIds.map(id => `item.id = ${id}`).join(' OR ');
                const queryString = `tracker.id = ${trackerId} AND (${itemIdConditions})`;              
                const queryUrl = `${defaults.cbApiUrl}/api/v3/items/query?page=1&pageSize=${items.length}&queryString=${encodeURIComponent(queryString)}`;              
                console.log(`CBQL Query URL: ${queryUrl}`);
                
                const queryResponse = await axios.get(queryUrl, {
                    headers: {
                        'Authorization': `Basic ${req.session.auth}`,
                        'Content-Type': 'application/json',
                        'accept': 'application/json'
                    }
                });
                
                if (queryResponse.data && queryResponse.data.items) {
                    items = queryResponse.data.items;
                    console.log(`Successfully fetched detailed data for ${items.length} items via CBQL`);
                } else {
                    console.warn('CBQL query returned no items, using basic item data');
                }
            } catch (error) {
                console.warn(`CBQL query failed: ${error.message}, using basic item data`);
            }
        }

        console.log(`Fetched ${items.length} items`);
        res.json({
            items: items,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total: items.length,
            hasMore: items.length === parseInt(pageSize)
        });
    } catch (error) {
        console.error('Error fetching items:', error.message);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});

app.get('/api/hardware', requireAuth, async (req, res) => {
    try {
        res.json({
            success: true,
            items: []
        });
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
        { id: 11, name: '작성자', codebeamerId: 'custom_field_11', type: 'string', required: true, readonly: false, referenceId: 10008 },
        { id: 4, name: '사업부', codebeamerId: 'custom_field_2', type: 'string', required: true, readonly: false, referenceId: 10001 },
        { id: 8, name: '담당 차종', codebeamerId: 'custom_field_8', type: 'selector', required: true, readonly: false, referenceId: 10005, options: ['SW', 'OV1', 'HE1i', 'SX3', 'NQ6', 'LT2'] },
        { id: 9, name: '금주 주간보고', codebeamerId: 'custom_field_9', type: 'textarea', required: true, readonly: false, referenceId: 10006 },
        { id: 10, name: '차주 주간보고', codebeamerId: 'custom_field_10', type: 'textarea', required: true, readonly: false, referenceId: 10007 }
    ],
    'travel-reports': [
        { id: 9, name: '작성자', codebeamerId: 'custom_field_9', type: 'string', required: true, readonly: false, referenceId: 10008 },
        { id: 2, name: '출장 지역', codebeamerId: 'custom_field_5', type: 'string', required: true, readonly: false, referenceId: 10001 },
        { id: 3, name: '출장 목적', codebeamerId: 'custom_field_6', type: 'string', required: true, readonly: false, referenceId: 10002 },
        { id: 4, name: '출발일', codebeamerId: 'custom_field_7', type: 'calendar', required: true, readonly: false, referenceId: 10003 },
        { id: 5, name: '도착일', codebeamerId: 'custom_field_8', type: 'calendar', required: true, readonly: false, referenceId: 10004 },
        { id: 8, name: '총 경비', codebeamerId: 'custom_field_11', type: 'number', required: false, readonly: false, referenceId: 10007 },
        { id: 10, name: '동행자', codebeamerId: 'custom_field_10', type: 'string', required: false, readonly: false, referenceId: 10009 }
    ],
    'hardware-management': [
        { id: 4, name: '변경 항목', codebeamerId: 'custom_field_4', type: 'selector', required: true, readonly: false, referenceId: 10004, options: ['HW', 'SW'] },
        { id: 1, name: '변경 사유', codebeamerId: 'custom_field_1', type: 'string', required: true, readonly: false, referenceId: 10001 },
        { id: 3, name: '버전', codebeamerId: 'custom_field_3', type: 'string', required: true, readonly: false, referenceId: 10003 },
        { id: 5, name: 'SW 버전', codebeamerId: 'custom_field_5', type: 'string', required: false, readonly: false, referenceId: 10005 }
    ],
    'equipment-management': [
        { id: 4, name: '장비명', codebeamerId: 'custom_field_4', type: 'string', required: true, readonly: false, referenceId: 10004 },
        { id: 1, name: '모델명', codebeamerId: 'custom_field_1', type: 'string', required: true, readonly: false, referenceId: 10001 },
        { id: 2, name: '시리얼번호', codebeamerId: 'custom_field_2', type: 'string', required: true, readonly: false, referenceId: 10002 },
        { id: 3, name: '담당자', codebeamerId: 'custom_field_3', type: 'string', required: false, readonly: false, referenceId: 10003 },
        { id: 7, name: '상태', codebeamerId: 'custom_field_7', type: 'selector', required: false, readonly: false, referenceId: 10007, options: ['입고', '재고', '출고', '입고 예정', '출고 예정'] },
        { id: 5, name: '장비 입고일', codebeamerId: 'custom_field_5', type: 'calendar', required: false, readonly: false, referenceId: 10005 },
        { id: 6, name: '장비 출고일', codebeamerId: 'custom_field_6', type: 'calendar', required: false, readonly: false, referenceId: 10006 }
    ],
    'external-training': [
        { id: 1, name: '교육명', codebeamerId: 'custom_field_1', type: 'string', required: false, readonly: false, referenceId: 10001 },
        { id: 2, name: '교육기관', codebeamerId: 'custom_field_2', type: 'string', required: true, readonly: false, referenceId: 10002 },
        { id: 3, name: '교육시작일', codebeamerId: 'custom_field_3', type: 'calendar', required: false, readonly: false, referenceId: 10003 },
        { id: 4, name: '교육종료일', codebeamerId: 'custom_field_4', type: 'calendar', required: false, readonly: false, referenceId: 10004 },
        { id: 5, name: '수료여부', codebeamerId: 'custom_field_5', type: 'selector', required: true, readonly: false, referenceId: 10005, options: ['수료', '중단', '필요 없음'] }
    ]
};

function getDefaultSectionTitles() {
    return {
        'weekly-reports': { name: '주간보고관리', icon: '📊' },
        'travel-reports': { name: '출장보고관리', icon: '✈️' },
        'hardware-management': { name: 'HW/SW 버전관리', icon: '💻' },
        'equipment-management': { name: '장비관리', icon: '🔧' },
        'external-training': { name: '교육관리', icon: '🎓' }
    };
}

function loadFieldConfigs() {
    try {
        if (fs.existsSync(FIELD_CONFIGS_FILE)) {
            const data = fs.readFileSync(FIELD_CONFIGS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            if (!parsed.sectionTitles) {
                parsed.sectionTitles = getDefaultSectionTitles();
            }
            return parsed;
        }
    } catch (error) {
        console.error('Error loading field configs:', error);
    }
    return { 
        fieldConfigs: DEFAULT_FIELD_CONFIGS,
        sectionTitles: getDefaultSectionTitles()
    };
}

function saveFieldConfigs(fieldConfigs, trackerIds = null) {
    try {
        const existingData = loadFieldConfigs();
        
        const data = { 
            fieldConfigs, 
            sectionTitles: existingData.sectionTitles || getDefaultSectionTitles(),
            lastUpdated: new Date().toISOString() 
        };
        
        if (trackerIds) {
            data.trackerIds = trackerIds;
        } else if (existingData.trackerIds) {
            data.trackerIds = existingData.trackerIds;
        }
        
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
        const { fieldConfigs, trackerIds } = req.body;
        
        console.log('=== SAVING FIELD CONFIGS ===');
        console.log('Sections:', Object.keys(fieldConfigs));
        
        if (!fieldConfigs || typeof fieldConfigs !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Field configurations object is required'
            });
        }

        if (saveFieldConfigs(fieldConfigs, trackerIds)) {
            console.log('✓ Field configs saved successfully to:', FIELD_CONFIGS_FILE);
            res.json({
                success: true,
                message: 'Field configurations and tracker IDs saved successfully',
                fieldConfigs: fieldConfigs,
                trackerIds: trackerIds
            });
        } else {
            console.error('✗ Failed to save field configurations');
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

app.get('/api/admin/section-titles', requireAdminAuth, (req, res) => {
    try {
        const data = loadFieldConfigs();
        res.json({
            success: true,
            sectionTitles: data.sectionTitles || getDefaultSectionTitles()
        });
    } catch (error) {
        console.error('Error getting section titles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load section titles: ' + error.message
        });
    }
});

app.post('/api/admin/section-titles', requireAdminAuth, (req, res) => {
    try {
        const { sectionTitles } = req.body;
        
        if (!sectionTitles || typeof sectionTitles !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Section titles object is required'
            });
        }

        const data = loadFieldConfigs();
        data.sectionTitles = sectionTitles;
        data.lastUpdated = new Date().toISOString();

        fs.writeFileSync(FIELD_CONFIGS_FILE, JSON.stringify(data, null, 2));
        console.log('Section titles saved successfully');

        res.json({
            success: true,
            message: 'Section titles saved successfully'
        });
    } catch (error) {
        console.error('Error saving section titles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save section titles: ' + error.message
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

app.get('/api/field-configs/tracker/:trackerId', requireAuth, (req, res) => {
    try {
        const { trackerId } = req.params;
        const data = loadFieldConfigs();
        
        if (!data.trackerIds) {
            return res.status(404).json({
                success: false,
                error: 'No tracker ID mappings found'
            });
        }
        
        let matchedSection = null;
        for (const [section, mappedTrackerId] of Object.entries(data.trackerIds)) {
            if (mappedTrackerId === trackerId) {
                matchedSection = section;
                break;
            }
        }
        
        if (!matchedSection) {
            return res.status(404).json({
                success: false,
                error: 'No field configuration found for this tracker'
            });
        }
        
        const fieldConfigs = data.fieldConfigs[matchedSection];
        if (!fieldConfigs) {
            return res.status(404).json({
                success: false,
                error: 'Field configuration not found'
            });
        }
        
        res.json({
            success: true,
            section: matchedSection,
            fieldConfigs: fieldConfigs
        });
    } catch (error) {
        console.error('Error getting field configs for tracker:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load field configs for tracker: ' + error.message
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

            try {
                const updatedFieldConfigs = await syncFieldReferenceIds(section, trackerId, fieldConfigs, req.session.auth);
                console.log('Synced field reference IDs for section:', section);
                
                res.json({
                    success: true,
                    message: 'Codebeamer configuration updated and field IDs synced successfully',
                    trackerId: trackerId,
                    fieldCount: updatedFieldConfigs.length,
                    response: response.data
                });
            } catch (syncError) {
                console.warn('Failed to sync field reference IDs:', syncError.message);
                res.json({
                    success: true,
                    message: 'Codebeamer configuration updated successfully (field sync failed)',
                    trackerId: trackerId,
                    fieldCount: fieldConfigs.length,
                    response: response.data,
                    warning: 'Field reference IDs were not synced: ' + syncError.message
                });
            }
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

async function syncFieldReferenceIds(section, trackerId, fieldConfigs, auth) {
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

        const codebeamerFields = response.data.fields || [];
        console.log(`Retrieved ${codebeamerFields.length} fields from Codebeamer tracker ${trackerId}`);
        
        const data = loadFieldConfigs();
        const updatedFieldConfigs = fieldConfigs.map(field => {
            const matchingField = codebeamerFields.find(cbField => 
                cbField.label === field.name.trim()
            );
            
            if (matchingField) {
                console.log(`Matched field "${field.name}" to Codebeamer referenceId: ${matchingField.referenceId}`);
                return {
                    ...field,
                    referenceId: matchingField.referenceId
                };
            } else {
                console.warn(`Could not find Codebeamer field for: ${field.name}`);
                return field;
            }
        });

        data.fieldConfigs[section] = updatedFieldConfigs;
        saveFieldConfigs(data.fieldConfigs, data.trackerIds);
        
        console.log(`Successfully synced ${updatedFieldConfigs.length} field reference IDs for section: ${section}`);
        return updatedFieldConfigs;
    } catch (error) {
        console.error('Error syncing field reference IDs:', error.message);
        throw error;
    }
}

app.post('/api/admin/sync-field-ids', requireAdminAuth, async (req, res) => {
    try {
        const { section, trackerId } = req.body;
        
        if (!section || !trackerId) {
            return res.status(400).json({
                success: false,
                error: 'Section and trackerId are required'
            });
        }

        if (!req.session || !req.session.auth) {
            return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
        }

        const data = loadFieldConfigs();
        const fieldConfigs = data.fieldConfigs[section];
        
        if (!fieldConfigs) {
            return res.status(404).json({
                success: false,
                error: 'Field configuration not found for section: ' + section
            });
        }

        const updatedFieldConfigs = await syncFieldReferenceIds(section, trackerId, fieldConfigs, req.session.auth);
        
        res.json({
            success: true,
            message: 'Field reference IDs synced successfully',
            section: section,
            trackerId: trackerId,
            fieldCount: updatedFieldConfigs.length,
            fields: updatedFieldConfigs.map(f => ({
                name: f.name,
                referenceId: f.referenceId || 'NOT SYNCED'
            }))
        });
    } catch (error) {
        console.error('Error syncing field IDs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync field reference IDs: ' + error.message
        });
    }
});

async function buildCodebeamerConfig(fieldConfigs, trackerId, projectId, auth) {
    const issueTypeId = 1;
    const position = 100;

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

    const existingFields = existingConfig?.fields || [];
    const newFields = [];
    const systemFields = existingFields.filter(field => 
        field.referenceId === 0 ||  // ID
        field.referenceId === 1 ||  // Tracker
        field.referenceId === 3 ||  // Summary
        field.referenceId === 88    // Attachment
    );
    
    console.log(`Keeping ${systemFields.length} system fields, removing ALL custom fields (will be replaced with admin settings)`);

    let customReferenceId = 10001;
    fieldConfigs.forEach((field, index) => {
        if (!field.name || field.name.trim() === '') {
            console.warn(`Skipping field with empty name at index ${index}`);
            return;
        }
        
        const useReferenceId = field.referenceId || customReferenceId++;
        
        const existingField = existingFields.find(f => f.referenceId === useReferenceId);
        const existingTypeId = existingField?.typeId;
        const newTypeId = getCodebeamerTypeId(field.type);
        
        const finalTypeId = existingTypeId !== undefined ? existingTypeId : newTypeId;
        
        if (existingTypeId !== undefined && existingTypeId !== newTypeId) {
            console.warn(`⚠️ Preserving existing type for field ${useReferenceId}: ${existingTypeId} (admin wants ${newTypeId} but CodeBeamer doesn't allow type changes)`);
        }
        
        const fieldConfig = {
            referenceId: useReferenceId,
            typeId: finalTypeId,
            position: 9080 + (index * 10),
            label: field.name.trim(),
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

        newFields.push(fieldConfig);
        console.log(`  → Adding custom field: ${fieldConfig.label} (referenceId: ${useReferenceId}, typeId: ${finalTypeId}, mandatory: ${fieldConfig.mandatory})`);
    });

    const field80Exists = systemFields.some(f => f.referenceId === 80) || newFields.some(f => f.referenceId === 80);
    const descriptionField = {
        referenceId: 80,
        typeId: 0,
        position: 8000,
        label: "Description",
        hidden: true,
        listable: false,
        mandatory: false,
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
    
    const allFields = [...systemFields];
    if (!field80Exists) {
        console.log('Adding field 80 (Description) to satisfy field 84 (Description Format) dependency');
        allFields.push(descriptionField);
    }
    allFields.push(...newFields);
    
    console.log(`Final configuration: ${systemFields.length} system + ${field80Exists ? 0 : 1} description + ${newFields.length} custom fields = ${allFields.length} total fields`);

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
        
            workflowIsActive: false,
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
        'string': 0,    // String/Text
        'number': 1,    // Integer
        'calendar': 3,  // Date/Timestamp
        'selector': 0   // Treat as String/Text (not Choice field)
    };
    return typeMapping[fieldType] || 0; // Default to String/Text
}


app.get('/api/equipment', requireAuth, async (req, res) => {
    try {
        res.json({
            success: true,
            items: []
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
        res.json({
            success: true,
            items: []
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
        res.json({
            success: true,
            items: []
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
        res.json({
            success: true,
            items: []
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

app.get('/api/admin/tracker-id/:section', requireAdminAuth, async (req, res) => {
    try {
        const { section } = req.params;
        const data = loadFieldConfigs();
        const trackerId = data.trackerIds && data.trackerIds[section];
        
        res.json({
            success: true,
            trackerId: trackerId || null,
            section: section
        });
    } catch (error) {
        console.error('Error getting tracker ID:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get tracker ID: ' + error.message
        });
    }
});

app.post('/api/admin/tracker-id/:section', requireAdminAuth, async (req, res) => {
    try {
        const { section } = req.params;
        const { trackerId } = req.body;
        
        if (!trackerId) {
            return res.status(400).json({
                success: false,
                error: 'Tracker ID is required'
            });
        }

        const data = loadFieldConfigs();
        if (!data.trackerIds) {
            data.trackerIds = {};
        }
        
        data.trackerIds[section] = trackerId;

        const updatedData = {
            fieldConfigs: data.fieldConfigs,
            trackerIds: data.trackerIds,
            lastUpdated: new Date().toISOString()
        };
        
        try {
            fs.writeFileSync(FIELD_CONFIGS_FILE, JSON.stringify(updatedData, null, 2));
            res.json({
                success: true,
                message: 'Tracker ID saved successfully',
                section: section,
                trackerId: trackerId
            });
        } catch (error) {
            console.error('Error saving tracker ID:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to save tracker ID'
            });
        }
    } catch (error) {
        console.error('Error setting tracker ID:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to set tracker ID: ' + error.message
        });
    }
});

app.get('/api/tracker-id/:section', requireAuth, async (req, res) => {
    try {
        const { section } = req.params;
        console.log(`Getting tracker ID for section: ${section}`);
        
        const data = loadFieldConfigs();
        console.log('Loaded data structure:', {
            hasFieldConfigs: !!data.fieldConfigs,
            hasTrackerIds: !!data.trackerIds,
            trackerIdsKeys: data.trackerIds ? Object.keys(data.trackerIds) : 'None'
        });
        
        const trackerId = data.trackerIds && data.trackerIds[section];
        console.log(`Tracker ID for ${section}: ${trackerId || 'Not found'}`);
        
        res.json({
            success: true,
            trackerId: trackerId || null,
            section: section
        });
    } catch (error) {
        console.error('Error getting tracker ID:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get tracker ID: ' + error.message
        });
    }
});

app.post('/api/v3/trackers/:trackerId/items', requireAuth, async (req, res) => {
    console.log('=== CREATE TRACKER ITEM REQUEST ===');
    console.log('Tracker ID:', req.params.trackerId);
    console.log('Session auth exists:', !!req.session?.auth);
    
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { trackerId } = req.params;
        const itemData = req.body;
        
        console.log('Creating tracker item:', { trackerId, itemData: JSON.stringify(itemData, null, 2) });
        
        if (!itemData.name) {
            return res.status(400).json({
                success: false,
                error: 'Item name is required'
            });
        }


        const codebeamerItemData = {
            name: itemData.name,
            description: itemData.description || 'Auto-generated entry'
        };
        
        if (itemData.status) {
            codebeamerItemData.status = itemData.status;
        }

        if (itemData.customFields && Array.isArray(itemData.customFields) && itemData.customFields.length > 0) {
            codebeamerItemData.customFields = itemData.customFields;
        } else {
            codebeamerItemData.customFields = [];
        }
        
        const field80Exists = codebeamerItemData.customFields.some(f => f.fieldId === 80);
        if (!field80Exists) {
            codebeamerItemData.customFields.push({
                fieldId: 80,
                value: codebeamerItemData.description,
                type: "TextFieldValue"
            });
        }

        console.log('Sending to CodeBeamer:', JSON.stringify(codebeamerItemData, null, 2));
        
        const createUrl = `${defaults.cbApiUrl}/api/v3/trackers/${trackerId}/items`;
        console.log('Creating item at URL:', createUrl);
        console.log('Using auth:', req.session.auth);
        console.log('Codebeamer base URL:', defaults.cbApiUrl);
        
        const response = await axios.post(createUrl, codebeamerItemData, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            timeout: 30000,
            validateStatus: function (status) {
                return status < 500; 
            }
        });

        console.log('CodeBeamer response status:', response.status);
        console.log('CodeBeamer response:', JSON.stringify(response.data, null, 2));

        if (response.status >= 200 && response.status < 300) {
            res.json({
                success: true,
                message: 'Tracker item created successfully',
                item: {
                    id: response.data.id,
                    name: response.data.name,
                    trackerId: trackerId,
                    createdAt: response.data.createdAt,
                    createdBy: response.data.createdBy
                }
            });
        } else {
            console.error('Codebeamer returned error status:', response.status);
            res.status(response.status).json({
                success: false,
                error: 'Codebeamer API error: ' + (response.data?.message || 'Unknown error'),
                details: response.data,
                status: response.status
            });
        }
    } catch (error) {
        console.error('=== ERROR IN CREATE TRACKER ITEM ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        if (error.response) {
            console.error('Error response status:', error.response.status);
            console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 403) {
                return res.status(403).json({
                    success: false,
                    error: 'Permission denied: You do not have permission to create items in this tracker',
                    message: 'The Codebeamer tracker requires specific permissions to create items. Please contact your administrator to grant you the necessary permissions.',
                    details: error.response.data,
                    troubleshooting: 'See TROUBLESHOOTING_403_PERMISSION.md for detailed steps to fix this issue'
                });
            }
            
            return res.status(error.response.status).json({
                success: false,
                error: 'Codebeamer API error: ' + error.message,
                details: error.response.data,
                status: error.response.status
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Internal server error: ' + error.message,
            details: error.stack
        });
    }
});

app.post('/api/v3/items/:itemId/attachments', requireAuth, upload.array('attachments', 10), async (req, res) => {
    console.log('=== UPLOAD ATTACHMENTS REQUEST ===');
    console.log('Item ID:', req.params.itemId);
    console.log('Files count:', req.files?.length || 0);
    
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { itemId } = req.params;
        
        if (!req.files || req.files.length === 0) {
            return res.json({
                success: true,
                message: 'No files to upload',
                attachments: []
            });
        }

        const uploadedAttachments = [];
        
        for (const file of req.files) {
            console.log(`Uploading file: ${file.originalname} (${file.size} bytes, mimetype: ${file.mimetype})`);
            
            const formData = new FormData();
            formData.append('attachments', file.buffer, {
                filename: file.originalname,
                contentType: file.mimetype
            });
            
            const uploadUrl = `${defaults.cbApiUrl}/api/v3/items/${itemId}/attachments`;
            console.log(`Upload URL: ${uploadUrl}`);
            
            try {
                const response = await axios.post(uploadUrl, formData, {
                    headers: {
                        'Authorization': `Basic ${req.session.auth}`,
                        ...formData.getHeaders()
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                    timeout: 60000,
                    validateStatus: function (status) {
                        return status < 500;
                    }
                });
                
                console.log(`CodeBeamer attachment response status: ${response.status}`);
                console.log(`CodeBeamer attachment response:`, JSON.stringify(response.data, null, 2));
                
                if (response.status >= 200 && response.status < 300) {
                    console.log(`✓ Uploaded: ${file.originalname}`);
                    
                    const attachmentId = response.data?.id || response.data?.[0]?.id || 'unknown';
                    uploadedAttachments.push({
                        name: file.originalname,
                        id: attachmentId,
                        size: file.size,
                        rawResponse: response.data
                    });
                } else {
                    console.error(`✗ Upload failed with status ${response.status}`);
                    uploadedAttachments.push({
                        name: file.originalname,
                        error: response.data?.message || `HTTP ${response.status}`
                    });
                }
            } catch (error) {
                console.error(`✗ Failed to upload ${file.originalname}:`, error.response?.data || error.message);
                if (error.response) {
                    console.error(`  Status: ${error.response.status}`);
                    console.error(`  Data:`, error.response.data);
                }
                uploadedAttachments.push({
                    name: file.originalname,
                    error: error.response?.data?.message || error.message
                });
            }
        }

        const failedUploads = uploadedAttachments.filter(a => a.error);
        
        res.json({
            success: failedUploads.length === 0,
            message: `Uploaded ${uploadedAttachments.length - failedUploads.length} of ${req.files.length} files`,
            attachments: uploadedAttachments,
            failedCount: failedUploads.length
        });
    } catch (error) {
        console.error('=== ERROR IN UPLOAD ATTACHMENTS ===');
        console.error('Error message:', error.message);
        
        res.status(500).json({
            success: false,
            error: 'Internal server error: ' + error.message
        });
    }
});

