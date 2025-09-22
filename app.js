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
            // Process the assigned items according to the required format
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
            // Fallback to mock data if no items found
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

// Admin Routes
app.get('/admin/login', (req, res) => {
    res.render('admin-login', { error: null });
});

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === '1234') {
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
    res.render('admin', {
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

// Hardware Management API Routes
const HARDWARE_TRACKER_ID = 19601; // Version tracker for hardware/software version management

// Helper functions to map choice values to IDs
function getVehicleTypeId(vehicleType) {
    const vehicleTypeMap = {
        'SW': 1,
        'OV1': 2,
        'HE1i': 3,
        'SX3': 4,
        'NQ6': 5,
        'LT2': 6
    };
    return vehicleTypeMap[vehicleType] || null;
}

function getChangeTypeId(changeType) {
    const changeTypeMap = {
        'H/W': 1,  // Maps to "HW" in the tracker
        'S/W': 2,  // Maps to "SW" in the tracker
        'HW': 1,
        'SW': 2
    };
    return changeTypeMap[changeType] || null;
}

app.get('/api/hardware', requireAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const codebeamerUrl = `${defaults.cbApiUrl}/api/v3/trackers/${HARDWARE_TRACKER_ID}/items`;
        console.log('Fetching hardware items from:', codebeamerUrl);
        
        const response = await axios.get(codebeamerUrl, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        const items = Array.isArray(response.data) ? response.data : response.data.itemRefs || [];
        
        // Fetch detailed information for each item
        const hardwareItems = [];
        for (const item of items) {
            try {
                const itemDetailUrl = `${defaults.cbApiUrl}/api/v3/items/${item.id}`;
                const itemResponse = await axios.get(itemDetailUrl, {
                    headers: {
                        'Authorization': `Basic ${req.session.auth}`,
                        'Content-Type': 'application/json',
                        'accept': 'application/json'
                    }
                });
                
                const itemDetail = itemResponse.data;
                console.log('Item detail structure:', JSON.stringify(itemDetail, null, 2));
                
                // Debug: Log the custom fields structure
                console.log('Custom fields:', itemDetail.customFields);
                
                // Debug: Log each field individually
                if (itemDetail.customFields) {
                    itemDetail.customFields.forEach((field, index) => {
                        console.log(`Field ${index}:`, {
                            fieldId: field.field?.id,
                            referenceId: field.field?.referenceId,
                            name: field.field?.name,
                            value: field.value,
                            values: field.values,
                            type: field.type
                        });
                    });
                }
                
                // Helper function to extract field value
                const getFieldValue = (referenceId, fieldName = null) => {
                    const field = itemDetail.customFields?.find(f => f.field?.referenceId === referenceId);
                    if (!field) return '';
                    
                    // Try different value access patterns
                    if (field.value) return field.value;
                    if (field.values && field.values.length > 0) {
                        if (field.values[0].name) return field.values[0].name;
                        if (field.values[0].value) return field.values[0].value;
                        return field.values[0];
                    }
                    return '';
                };
                
                hardwareItems.push({
                    id: itemDetail.id,
                    name: itemDetail.name,
                    description: itemDetail.description,
                    status: itemDetail.status?.name || 'Unknown',
                    hwVersion: getFieldValue(3),
                    swVersion: getFieldValue(10002),
                    vehicleType: getFieldValue(1000),
                    changeType: getFieldValue(1001),
                    changeReason: getFieldValue(10005),
                    releaseDate: getFieldValue(10006),
                    submittedAt: itemDetail.submittedAt,
                    submittedBy: itemDetail.submittedBy?.name || '',
                    modifiedAt: itemDetail.modifiedAt,
                    modifiedBy: itemDetail.modifiedBy?.name || ''
                });
            } catch (error) {
                console.error(`Error fetching details for item ${item.id}:`, error.message);
                // Add item with basic info if detail fetch fails
                hardwareItems.push({
                    id: item.id,
                    name: item.name,
                    description: item.description || '',
                    status: item.status?.name || 'Unknown',
                    hwVersion: 'Error',
                    swVersion: 'Error',
                    vehicleType: 'Error',
                    changeType: 'Error',
                    changeReason: 'Error',
                    releaseDate: 'Error',
                    submittedAt: item.submittedAt,
                    submittedBy: item.submittedBy?.name || '',
                    modifiedAt: item.modifiedAt,
                    modifiedBy: item.modifiedBy?.name || ''
                });
            }
        }

        res.json({
            success: true,
            items: hardwareItems
        });
    } catch (error) {
        console.error('Error fetching hardware items:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch hardware items: ' + error.message 
        });
    }
});

app.post('/api/hardware', requireAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { name, description, hwVersion, swVersion, vehicleType, changeType, changeReason, releaseDate } = req.body;
        
        if (!name || !hwVersion) {
            return res.status(400).json({ 
                success: false,
                error: 'Name and H/W Version are required' 
            });
        }

        const codebeamerUrl = `${defaults.cbApiUrl}/api/v3/trackers/${HARDWARE_TRACKER_ID}/items`;
        console.log('Creating hardware item at:', codebeamerUrl);
        
        const itemData = {
            name: hwVersion, // HW 버전 becomes the item name
            description: description || '',
            customFields: [
                {
                    fieldId: 3, // HW 버전 (typeId: 0 = text, mandatory)
                    name: "HW 버전",
                    value: hwVersion,
                    type: 'TextFieldValue'
                },
                {
                    fieldId: 10002, // SW 버전 (typeId: 0 = text)
                    name: "SW 버전",
                    value: swVersion || '',
                    type: 'TextFieldValue'
                },
                {
                    fieldId: 1000, // 차종 (typeId: 6 = choice)
                    name: "차종",
                    values: vehicleType ? [{ id: getVehicleTypeId(vehicleType), name: vehicleType, type: 'ChoiceOptionReference' }] : [],
                    type: 'ChoiceFieldValue'
                },
                {
                    fieldId: 1001, // 변경사항 (typeId: 6 = choice)
                    name: "변경사항",
                    values: changeType ? [{ 
                        id: getChangeTypeId(changeType), 
                        name: changeType === 'H/W' ? 'HW' : changeType === 'S/W' ? 'SW' : changeType, 
                        type: 'ChoiceOptionReference' 
                    }] : [],
                    type: 'ChoiceFieldValue'
                },
                {
                    fieldId: 10005, // 변경 사유 (typeId: 10 = text, mandatory)
                    name: "변경 사유",
                    value: changeReason || '',
                    type: 'TextFieldValue'
                },
                {
                    fieldId: 10006, // Release 일자 (typeId: 3 = date)
                    name: "Release 일자",
                    value: releaseDate ? new Date(releaseDate).toISOString() : '',
                    type: 'DateFieldValue'
                }
            ]
        };

        const response = await axios.post(codebeamerUrl, itemData, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        res.json({
            success: true,
            item: response.data,
            message: 'Hardware item created successfully'
        });
    } catch (error) {
        console.error('Error creating hardware item:', error.message);
        if (error.response) {
            console.error('Error response:', error.response.data);
        }
        res.status(500).json({ 
            success: false,
            error: 'Failed to create hardware item: ' + error.message 
        });
    }
});

// Note: CodeBeamer does not support PUT API for updating items
// Items can only be created (POST) or deleted (DELETE)

app.delete('/api/hardware/:id', requireAuth, async (req, res) => {
    if (!req.session || !req.session.auth) {
        return res.status(401).json({ error: '인가되지 않은 사용자입니다' });
    }

    try {
        const { id } = req.params;
        const codebeamerUrl = `${defaults.cbApiUrl}/api/v3/items/${id}`;
        console.log('Deleting hardware item at:', codebeamerUrl);
        
        await axios.delete(codebeamerUrl, {
            headers: {
                'Authorization': `Basic ${req.session.auth}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        res.json({
            success: true,
            message: 'Hardware item deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting hardware item:', error.message);
        if (error.response) {
            console.error('Error response:', error.response.data);
        }
        res.status(500).json({ 
            success: false,
            error: 'Failed to delete hardware item: ' + error.message 
        });
    }
});

// Vehicle Type Configuration API Routes
const VEHICLE_TYPES_FILE = path.join(__dirname, 'data', 'vehicle-types.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Default vehicle types
const DEFAULT_VEHICLE_TYPES = ['SW', 'OV1', 'HE1i', 'SX3', 'NQ6', 'LT2'];

// Load vehicle types from file
function loadVehicleTypes() {
    try {
        if (fs.existsSync(VEHICLE_TYPES_FILE)) {
            const data = fs.readFileSync(VEHICLE_TYPES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading vehicle types:', error);
    }
    return { vehicleTypes: DEFAULT_VEHICLE_TYPES };
}

// Save vehicle types to file
function saveVehicleTypes(vehicleTypes) {
    try {
        const data = { vehicleTypes, lastUpdated: new Date().toISOString() };
        fs.writeFileSync(VEHICLE_TYPES_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving vehicle types:', error);
        return false;
    }
}

// GET vehicle types
app.get('/api/admin/vehicle-types', requireAdminAuth, (req, res) => {
    try {
        const data = loadVehicleTypes();
        res.json({
            success: true,
            vehicleTypes: data.vehicleTypes
        });
    } catch (error) {
        console.error('Error getting vehicle types:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load vehicle types: ' + error.message
        });
    }
});

// POST vehicle types
app.post('/api/admin/vehicle-types', requireAdminAuth, (req, res) => {
    try {
        const { vehicleTypes } = req.body;
        
        if (!vehicleTypes || !Array.isArray(vehicleTypes) || vehicleTypes.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle types array is required and cannot be empty'
            });
        }

        // Validate vehicle types
        const validVehicleTypes = vehicleTypes.filter(type => 
            typeof type === 'string' && type.trim().length > 0
        );

        if (validVehicleTypes.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one valid vehicle type is required'
            });
        }

        if (saveVehicleTypes(validVehicleTypes)) {
            res.json({
                success: true,
                message: 'Vehicle types saved successfully',
                vehicleTypes: validVehicleTypes
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to save vehicle types'
            });
        }
    } catch (error) {
        console.error('Error saving vehicle types:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save vehicle types: ' + error.message
        });
    }
});

// GET vehicle types for hardware management (public endpoint)
app.get('/api/vehicle-types', (req, res) => {
    try {
        const data = loadVehicleTypes();
        res.json({
            success: true,
            vehicleTypes: data.vehicleTypes
        });
    } catch (error) {
        console.error('Error getting vehicle types:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load vehicle types: ' + error.message
        });
    }
});

