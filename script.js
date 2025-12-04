// Database variables
let db = null;
let isDatabaseLoaded = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing Database Dashboard...');
    
    // Set current year
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Update time
    updateTime();
    setInterval(updateTime, 1000);
    
    // Initialize database connection
    await initializeDatabase();
    
    // Set up query presets
    setupQueryPresets();
});

// Update time display
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('update-time').textContent = timeString;
}

// Initialize database connection
async function initializeDatabase() {
    try {
        const statusElement = document.getElementById('connection-status');
        statusElement.innerHTML = '<i class="fas fa-circle" style="color: orange;"></i> Connecting...';
        
        // Load the SQL.js library if not already loaded
        if (!window.SQL) {
            await loadSQLiteLibrary();
        }
        
        // Load your MHC_Project.db file
        console.log('Loading MHC_Project.db...');
        const response = await fetch('MHC_Project.db');
        
        if (!response.ok) {
            throw new Error(`Failed to load database file: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Initialize SQL.js with the database
        const SQL = await window.initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        // Create database instance
        db = new SQL.Database(uint8Array);
        isDatabaseLoaded = true;
        
        console.log('Database loaded successfully!');
        statusElement.innerHTML = '<i class="fas fa-circle" style="color: #10b981;"></i> Connected to MHC_Project.db';
        
        // Load initial data
        await loadTables();
        await loadDatabaseStats();
        await loadSampleDataPreview();
        
    } catch (error) {
        console.error('Database initialization failed:', error);
        document.getElementById('connection-status').innerHTML = 
            '<i class="fas fa-circle" style="color: red;"></i> Connection Failed';
        document.getElementById('tables-list').innerHTML = 
            '<div class="no-data">Failed to load database. Check console for details.</div>';
        
        // Fallback to demo mode
        setupDemoMode();
    }
}

// Load SQL.js library dynamically
async function loadSQLiteLibrary() {
    return new Promise((resolve, reject) => {
        if (window.SQL) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Execute SQL query
async function executeQuery() {
    const queryInput = document.getElementById('sql-query');
    const query = queryInput.value.trim();
    
    if (!query) {
        alert('Please enter a SQL query');
        return;
    }
    
    // Update UI state
    const tableBody = document.getElementById('table-body');
    const tableHeaders = document.getElementById('table-headers');
    tableBody.innerHTML = '<tr><td colspan="5" class="loading">Executing query...</td></tr>';
    tableHeaders.innerHTML = '';
    
    const startTime = performance.now();
    
    try {
        let result;
        
        if (isDatabaseLoaded && db) {
            // Execute query on real database
            result = executeRealQuery(query);
        } else {
            // Use demo data
            result = executeDemoQuery(query);
        }
        
        const endTime = performance.now();
        const executionTime = Math.round(endTime - startTime);
        
        // Display results
        if (result.error) {
            throw new Error(result.error);
        }
        
        if (result.data && result.data.length > 0) {
            displayQueryResults(result.data, result.columns);
            document.getElementById('row-count').textContent = `Rows: ${result.data.length}`;
        } else if (result.affectedRows !== undefined) {
            tableBody.innerHTML = `<tr><td colspan="5" class="no-data">
                Query executed successfully.<br>
                Affected rows: ${result.affectedRows}<br>
                Last inserted ID: ${result.lastInsertRowid || 'N/A'}
            </td></tr>`;
            document.getElementById('row-count').textContent = 'Rows: 0';
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" class="no-data">Query returned no results</td></tr>';
            document.getElementById('row-count').textContent = 'Rows: 0';
        }
        
        document.getElementById('execution-time').textContent = `Time: ${executionTime}ms`;
        updateQueryCount();
        
    } catch (error) {
        console.error('Query execution error:', error);
        tableBody.innerHTML = `<tr><td colspan="5" class="no-data" style="color: red;">
            <strong>Error:</strong> ${error.message}<br>
            <small>Check the browser console for details</small>
        </td></tr>`;
        document.getElementById('row-count').textContent = 'Rows: 0';
    }
}

// Execute query on real SQLite database
function executeRealQuery(query) {
    if (!db) throw new Error('Database not loaded');
    
    const upperQuery = query.toUpperCase();
    
    try {
        // For SELECT queries
        if (upperQuery.startsWith('SELECT') || upperQuery.startsWith('PRAGMA') || upperQuery.startsWith('WITH')) {
            const stmt = db.prepare(query);
            const columns = stmt.getColumnNames();
            const data = [];
            
            while (stmt.step()) {
                const row = stmt.get();
                const rowObj = {};
                columns.forEach((col, index) => {
                    rowObj[col] = row[index];
                });
                data.push(rowObj);
            }
            
            stmt.free();
            return { data, columns };
        }
        // For other queries (INSERT, UPDATE, DELETE, CREATE, etc.)
        else {
            db.run(query);
            return {
                affectedRows: db.getRowsModified(),
                lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0]
            };
        }
    } catch (error) {
        return { error: error.message };
    }
}

// Display query results in table
function displayQueryResults(data, columns) {
    const tableHeaders = document.getElementById('table-headers');
    const tableBody = document.getElementById('table-body');
    
    // Clear previous results
    tableHeaders.innerHTML = '';
    tableBody.innerHTML = '';
    
    // Create headers
    columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        th.title = `Click to sort by ${column}`;
        th.style.cursor = 'pointer';
        th.onclick = () => sortTable(column);
        tableHeaders.appendChild(th);
    });
    
    // Create rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        columns.forEach(column => {
            const td = document.createElement('td');
            let value = row[column];
            
            // Format special values
            if (value === null || value === undefined) {
                value = '<span style="color: #999; font-style: italic;">NULL</span>';
                td.innerHTML = value;
            } else if (typeof value === 'boolean') {
                value = value ? '✓' : '✗';
                td.textContent = value;
            } else if (typeof value === 'number') {
                td.textContent = Number(value).toLocaleString();
                td.style.textAlign = 'right';
                td.style.fontFamily = 'monospace';
            } else {
                td.textContent = value;
            }
            
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

// Sort table by column
function sortTable(column) {
    // Implementation for sorting
    console.log('Sorting by', column);
    // You can implement actual sorting logic here
}

// Load database tables
async function loadTables() {
    const tablesList = document.getElementById('tables-list');
    tablesList.innerHTML = '<div class="loading">Loading tables...</div>';
    
    try {
        let tables = [];
        
        if (isDatabaseLoaded && db) {
            // Get all tables from SQLite
            const result = db.exec(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `);
            
            if (result.length > 0) {
                tables = result[0].values.map(row => ({ name: row[0] }));
                
                // Get row count for each table
                for (let table of tables) {
                    try {
                        const countResult = db.exec(`SELECT COUNT(*) as count FROM "${table.name}"`);
                        table.rows = countResult[0]?.values[0]?.[0] || 0;
                        
                        // Get sample column names
                        const sampleResult = db.exec(`SELECT * FROM "${table.name}" LIMIT 1`);
                        if (sampleResult.length > 0) {
                            table.columns = sampleResult[0].columns;
                        }
                    } catch (e) {
                        console.warn(`Could not read table ${table.name}:`, e.message);
                        table.rows = 0;
                        table.columns = [];
                    }
                }
            }
        }
        
        displayTables(tables);
        
    } catch (error) {
        console.error('Error loading tables:', error);
        tablesList.innerHTML = '<div class="no-data">Error loading tables</div>';
    }
}

// Display tables in UI
function displayTables(tables) {
    const tablesList = document.getElementById('tables-list');
    
    if (!tables || tables.length === 0) {
        tablesList.innerHTML = '<div class="no-data">No tables found in database</div>';
        return;
    }
    
    tablesList.innerHTML = '';
    
    tables.forEach(table => {
        const tableItem = document.createElement('div');
        tableItem.className = 'table-item';
        tableItem.title = `Click to query ${table.name}`;
        
        tableItem.innerHTML = `
            <div class="table-name">
                <i class="fas fa-table"></i> ${table.name}
            </div>
            <div class="table-rows">
                ${table.rows.toLocaleString()} rows
            </div>
            ${table.columns ? `
            <div class="table-columns">
                <small>Columns: ${table.columns.slice(0, 3).join(', ')}${table.columns.length > 3 ? '...' : ''}</small>
            </div>
            ` : ''}
        `;
        
        tableItem.addEventListener('click', () => {
            document.getElementById('sql-query').value = `SELECT * FROM "${table.name}" LIMIT 100`;
            executeQuery();
        });
        
        tablesList.appendChild(tableItem);
    });
}

// Load database statistics
async function loadDatabaseStats() {
    try {
        if (!isDatabaseLoaded || !db) {
            setDefaultStats();
            return;
        }
        
        // Get total tables
        const tablesResult = db.exec("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        const totalTables = tablesResult[0]?.values[0]?.[0] || 0;
        
        // Get total rows across all tables
        let totalRows = 0;
        const allTables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        
        if (allTables.length > 0) {
            for (const tableRow of allTables[0].values) {
                const tableName = tableRow[0];
                try {
                    const countResult = db.exec(`SELECT COUNT(*) as count FROM "${tableName}"`);
                    totalRows += countResult[0]?.values[0]?.[0] || 0;
                } catch (e) {
                    // Skip tables we can't count
                }
            }
        }
        
        // Get database size (estimated)
        const sizeResult = db.exec("PRAGMA page_count;");
        const pageCount = sizeResult[0]?.values[0]?.[0] || 0;
        const pageSizeResult = db.exec("PRAGMA page_size;");
        const pageSize = pageSizeResult[0]?.values[0]?.[0] || 1024;
        const dbSizeMB = (pageCount * pageSize) / (1024 * 1024);
        
        // Update UI
        document.getElementById('total-tables').textContent = totalTables;
        document.getElementById('total-rows').textContent = totalRows.toLocaleString();
        document.getElementById('db-size').textContent = `${dbSizeMB.toFixed(2)} MB`;
        document.getElementById('query-count').textContent = '0';
        
    } catch (error) {
        console.error('Error loading stats:', error);
        setDefaultStats();
    }
}

// Set default statistics
function setDefaultStats() {
    document.getElementById('total-tables').textContent = '?';
    document.getElementById('total-rows').textContent = '?';
    document.getElementById('db-size').textContent = '? MB';
    document.getElementById('query-count').textContent = '0';
}

// Load sample data preview
async function loadSampleDataPreview() {
    if (!isDatabaseLoaded || !db) return;
    
    try {
        // Get first table to show sample data
        const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1");
        
        if (tablesResult.length > 0 && tablesResult[0].values.length > 0) {
            const firstTable = tablesResult[0].values[0][0];
            const sampleResult = db.exec(`SELECT * FROM "${firstTable}" LIMIT 5`);
            
            if (sampleResult.length > 0 && sampleResult[0].values.length > 0) {
                // Optional: Display sample data somewhere
                console.log(`Sample data from ${firstTable}:`, sampleResult[0].values);
            }
        }
    } catch (error) {
        console.warn('Could not load sample data:', error);
    }
}

// Setup query presets
function setupQueryPresets() {
    const presetSelect = document.getElementById('query-presets');
    
    presetSelect.addEventListener('change', function(e) {
        if (e.target.value) {
            document.getElementById('sql-query').value = e.target.value;
        }
    });
    
    // Update presets based on database content
    if (isDatabaseLoaded && db) {
        try {
            const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            
            if (tablesResult.length > 0) {
                // Clear existing options except the first one
                while (presetSelect.options.length > 1) {
                    presetSelect.remove(1);
                }
                
                // Add table-specific queries
                tablesResult[0].values.forEach(tableRow => {
                    const tableName = tableRow[0];
                    const option1 = new Option(`SELECT * FROM ${tableName} LIMIT 10`, `SELECT * FROM "${tableName}" LIMIT 10`);
                    const option2 = new Option(`Count rows in ${tableName}`, `SELECT COUNT(*) as total FROM "${tableName}"`);
                    
                    presetSelect.add(option1);
                    presetSelect.add(option2);
                });
                
                // Add utility queries
                const utilityQueries = [
                    ['Show all tables', 'SELECT name FROM sqlite_master WHERE type="table" ORDER BY name'],
                    ['Show table schema', 'SELECT sql FROM sqlite_master WHERE type="table" AND name NOT LIKE "sqlite_%"'],
                    ['Database info', 'PRAGMA database_list;']
                ];
                
                utilityQueries.forEach(([text, query]) => {
                    presetSelect.add(new Option(text, query));
                });
            }
        } catch (error) {
            console.warn('Could not update query presets:', error);
        }
    }
}

// Clear query input
function clearQuery() {
    document.getElementById('sql-query').value = '';
    document.getElementById('table-headers').innerHTML = '';
    document.getElementById('table-body').innerHTML = 
        '<tr><td colspan="5" class="no-data">No data to display. Run a query to see results.</td></tr>';
    document.getElementById('row-count').textContent = 'Rows: 0';
    document.getElementById('execution-time').textContent = 'Time: 0ms';
}

// Update query count
function updateQueryCount() {
    const countElement = document.getElementById('query-count');
    const currentCount = parseInt(countElement.textContent) || 0;
    countElement.textContent = (currentCount + 1).toString();
}

// Setup demo mode (fallback)
function setupDemoMode() {
    console.log('Setting up demo mode with sample data');
    
    document.getElementById('connection-status').innerHTML = 
        '<i class="fas fa-circle" style="color: orange;"></i> Demo Mode (Using Sample Data)';
    
    // Load demo tables
    const demoTables = [
        { name: 'users', rows: 5, columns: ['id', 'name', 'email', 'age'] },
        { name: 'products', rows: 5, columns: ['id', 'name', 'price', 'category'] },
        { name: 'orders', rows: 5, columns: ['id', 'user_id', 'product_id', 'quantity'] }
    ];
    
    displayTables(demoTables);
    
    // Update stats
    document.getElementById('total-tables').textContent = '3';
    document.getElementById('total-rows').textContent = '15';
    document.getElementById('db-size').textContent = '0.5 MB';
}

// Demo query execution (fallback)
function executeDemoQuery(query) {
    const upperQuery = query.toUpperCase();
    
    // Sample data for demo mode
    const demoData = {
        users: [
            { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 },
            { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35 }
        ],
        products: [
            { id: 1, name: 'Laptop', price: 999.99, category: 'Electronics' },
            { id: 2, name: 'Mouse', price: 29.99, category: 'Accessories' },
            { id: 3, name: 'Keyboard', price: 89.99, category: 'Accessories' }
        ]
    };
    
    if (upperQuery.includes('SELECT') && upperQuery.includes('USERS')) {
        return { 
            data: demoData.users, 
            columns: ['id', 'name', 'email', 'age'] 
        };
    } else if (upperQuery.includes('SELECT') && upperQuery.includes('PRODUCTS')) {
        return { 
            data: demoData.products, 
            columns: ['id', 'name', 'price', 'category'] 
        };
    } else if (upperQuery.includes('COUNT')) {
        return { 
            data: [{ total: 3 }], 
            columns: ['total'] 
        };
    } else if (upperQuery.includes('SHOW TABLES') || upperQuery.includes('SQLITE_MASTER')) {
        return { 
            data: [
                { name: 'users' },
                { name: 'products' },
                { name: 'orders' }
            ], 
            columns: ['name'] 
        };
    }
    
    return { data: [], columns: [] };
}

// Export functionality (optional)
function exportToCSV() {
    const table = document.getElementById('results-table');
    const rows = table.querySelectorAll('tr');
    const csv = [];
    
    rows.forEach(row => {
        const rowData = [];
        const cols = row.querySelectorAll('td, th');
        
        cols.forEach(col => {
            rowData.push(`"${col.textContent.replace(/"/g, '""')}"`);
        });
        
        csv.push(rowData.join(','));
    });
    
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mhc_query_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}

// Add export button to your HTML and connect this function
// MHC Query Library System
let queryLibrary = [];
let currentView = 'grid';
let currentSection = 'all';
let currentSearch = '';
let currentTypeFilter = 'all';
let currentSort = 'section';

// Initialize query library from SQL files
async function initializeQueryLibrary() {
    console.log('Initializing MHC Query Library...');
    
    // Show loading state
    showLoadingState();
    
    // Load from SQL files
    await loadQueriesFromSQLFiles();
    
    // Load from localStorage for saved queries
    loadSavedQueries();
    
    // Initialize UI
    initializeLibraryUI();
    
    // Display queries
    displayQueries();
    
    // Update statistics
    updateQueryStatistics();
}

// Show loading state
function showLoadingState() {
    const container = document.getElementById('queries-container');
    container.innerHTML = `
        <div class="loading-queries">
            <div class="spinner"></div>
            <p>Loading queries from SQL files...</p>
            <div class="loading-progress">
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill"></div>
                </div>
                <div class="loading-files" id="loading-files"></div>
            </div>
        </div>
    `;
}

// Load queries from SQL files
async function loadQueriesFromSQLFiles() {
    const sqlFiles = [
        { 
            filename: 'section1_demographics.sql', 
            section: 'demographics',
            icon: 'users',
            color: '#1e40af'
        },
        { 
            filename: 'section2_mental_health.sql', 
            section: 'mental_health',
            icon: 'brain',
            color: '#0369a1'
        },
        { 
            filename: 'section3_criminal_history.sql', 
            section: 'criminal_history',
            icon: 'gavel',
            color: '#92400e'
        },
        { 
            filename: 'section4_performance.sql', 
            section: 'performance',
            icon: 'chart-line',
            color: '#166534'
        },
        { 
            filename: 'section5_analytics.sql', 
            section: 'analytics',
            icon: 'chart-bar',
            color: '#86198f'
        }
    ];
    
    let totalQueries = 0;
    
    for (const file of sqlFiles) {
        try {
            const queries = await loadSQLFile(file.filename, file.section);
            queryLibrary = [...queryLibrary, ...queries];
            totalQueries += queries.length;
            
            // Update loading progress
            updateLoadingProgress(file.filename, queries.length);
            
            console.log(`Loaded ${queries.length} queries from ${file.filename}`);
        } catch (error) {
            console.error(`Failed to load ${file.filename}:`, error);
            // Create demo queries for missing files
            const demoQueries = createDemoQueriesForSection(file.section);
            queryLibrary = [...queryLibrary, ...demoQueries];
            totalQueries += demoQueries.length;
            
            updateLoadingProgress(`${file.filename} (demo)`, demoQueries.length);
        }
    }
    
    console.log(`Total queries loaded: ${totalQueries}`);
}

// Load a single SQL file
async function loadSQLFile(filename, section) {
    try {
        const response = await fetch(filename);
        if (!response.ok) {
            throw new Error(`File not found: ${filename}`);
        }
        
        const sqlContent = await response.text();
        return parseSQLFile(sqlContent, section, filename);
        
    } catch (error) {
        console.error(`Error loading ${filename}:`, error);
        throw error;
    }
}

// Parse SQL file content into query objects
function parseSQLFile(content, section, filename) {
    const queries = [];
    const lines = content.split('\n');
    
    let currentQuery = {
        id: '',
        title: '',
        sql: '',
        section: section,
        type: 'select',
        description: '',
        usageCount: 0,
        lastUsed: null,
        sourceFile: filename,
        createdAt: new Date().toISOString()
    };
    
    let inCommentBlock = false;
    let inQuery = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines at the start of a query
        if (!inQuery && !line) continue;
        
        // Handle multi-line comments
        if (line.startsWith('/*')) {
            inCommentBlock = true;
            if (line.includes('*/')) {
                inCommentBlock = false;
            }
            continue;
        }
        
        if (inCommentBlock) {
            if (line.includes('*/')) {
                inCommentBlock = false;
            }
            continue;
        }
        
        // Handle single-line comments for metadata
        if (line.startsWith('--')) {
            if (line.toLowerCase().includes('name:') || line.toLowerCase().includes('title:')) {
                // If we have a previous query, save it
                if (inQuery && currentQuery.sql) {
                    finalizeQuery(currentQuery);
                    queries.push({...currentQuery});
                    resetCurrentQuery(currentQuery, section, filename);
                }
                
                const title = line.split(':')[1]?.trim() || `Query from ${section}`;
                currentQuery.title = title;
                currentQuery.id = generateQueryId(section, title);
                inQuery = true;
            } else if (line.toLowerCase().includes('description:')) {
                currentQuery.description = line.split(':')[1]?.trim() || '';
            }
        }
        // SQL statements
        else if (line) {
            if (!inQuery) {
                // Start a new query without a title comment
                if (currentQuery.sql) {
                    finalizeQuery(currentQuery);
                    queries.push({...currentQuery});
                    resetCurrentQuery(currentQuery, section, filename);
                }
                currentQuery.title = `Query ${queries.length + 1} from ${section}`;
                currentQuery.id = generateQueryId(section, `query_${queries.length + 1}`);
                inQuery = true;
            }
            
            currentQuery.sql += (currentQuery.sql ? '\n' : '') + line;
            
            // Check if this line ends the query
            if (line.endsWith(';')) {
                inQuery = false;
            }
        }
        // Empty line might indicate end of query
        else if (inQuery && currentQuery.sql) {
            inQuery = false;
        }
    }
    
    // Add the last query if exists
    if (currentQuery.sql) {
        finalizeQuery(currentQuery);
        queries.push({...currentQuery});
    }
    
    return queries;
}

// Finalize query object
function finalizeQuery(query) {
    // Clean up SQL
    query.sql = query.sql.trim();
    
    // Determine query type
    query.type = determineQueryType(query.sql);
    
    // Generate ID if not set
    if (!query.id) {
        query.id = generateQueryId(query.section, query.title || 'untitled');
    }
}

// Reset current query object
function resetCurrentQuery(query, section, filename) {
    query.id = '';
    query.title = '';
    query.sql = '';
    query.section = section;
    query.type = 'select';
    query.description = '';
    query.sourceFile = filename;
}

// Generate query ID
function generateQueryId(section, title) {
    const base = `${section}_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const random = Math.random().toString(36).substr(2, 6);
    return `${base}_${random}`;
}

// Determine query type from SQL
function determineQueryType(sql) {
    if (!sql) return 'select';
    
    const upperSQL = sql.toUpperCase().trim();
    
    if (upperSQL.includes('JOIN') || upperSQL.includes('UNION') || 
        upperSQL.includes('WITH') || upperSQL.includes('CASE WHEN') ||
        (upperSQL.match(/SELECT/g) || []).length > 1) {
        return 'complex';
    } else if (upperSQL.startsWith('SELECT')) {
        return 'select';
    } else if (upperSQL.startsWith('INSERT')) {
        return 'insert';
    } else if (upperSQL.startsWith('UPDATE')) {
        return 'update';
    } else if (upperSQL.startsWith('DELETE')) {
        return 'delete';
    } else if (upperSQL.startsWith('CREATE') || upperSQL.startsWith('DROP') || 
               upperSQL.startsWith('ALTER')) {
        return 'create';
    } else if (upperSQL.startsWith('PRAGMA') || upperSQL.startsWith('EXPLAIN')) {
        return 'utility';
    }
    
    return 'other';
}

// Create demo queries for missing sections
function createDemoQueriesForSection(section) {
    const demoQueries = {
        demographics: [
            {
                id: generateQueryId('demographics', 'count_patients_by_age'),
                title: 'Count Patients by Age Group',
                sql: `SELECT 
    CASE 
        WHEN age < 18 THEN 'Under 18'
        WHEN age BETWEEN 18 AND 30 THEN '18-30'
        WHEN age BETWEEN 31 AND 50 THEN '31-50'
        WHEN age > 50 THEN 'Over 50'
        ELSE 'Unknown'
    END as age_group,
    COUNT(*) as patient_count
FROM patients
GROUP BY age_group
ORDER BY patient_count DESC;`,
                section: 'demographics',
                type: 'complex',
                description: 'Categorize patients by age groups'
            }
        ],
        mental_health: [
            {
                id: generateQueryId('mental_health', 'active_diagnoses'),
                title: 'Active Mental Health Diagnoses',
                sql: `SELECT 
    diagnosis_code,
    diagnosis_name,
    COUNT(*) as patient_count,
    AVG(severity_score) as avg_severity
FROM mental_health_records
WHERE status = 'active'
GROUP BY diagnosis_code, diagnosis_name
ORDER BY patient_count DESC;`,
                section: 'mental_health',
                type: 'select',
                description: 'List active mental health diagnoses with statistics'
            }
        ],
        criminal_history: [
            {
                id: generateQueryId('criminal_history', 'offense_types'),
                title: 'Criminal Offense Types Distribution',
                sql: `SELECT 
    offense_type,
    severity_level,
    COUNT(*) as offense_count,
    MIN(date_occurred) as earliest_offense,
    MAX(date_occurred) as latest_offense
FROM criminal_records
GROUP BY offense_type, severity_level
ORDER BY offense_count DESC;`,
                section: 'criminal_history',
                type: 'select',
                description: 'Analyze distribution of criminal offense types'
            }
        ],
        performance: [
            {
                id: generateQueryId('performance', 'treatment_progress'),
                title: 'Treatment Progress Metrics',
                sql: `SELECT 
    p.patient_id,
    p.name,
    COUNT(DISTINCT t.session_id) as total_sessions,
    AVG(t.progress_score) as avg_progress,
    MAX(t.progress_score) - MIN(t.progress_score) as progress_range
FROM patients p
JOIN treatment_sessions t ON p.patient_id = t.patient_id
WHERE t.session_date >= DATE('now', '-90 days')
GROUP BY p.patient_id, p.name
HAVING total_sessions >= 5
ORDER BY avg_progress DESC;`,
                section: 'performance',
                type: 'complex',
                description: 'Calculate treatment progress metrics for active patients'
            }
        ],
        analytics: [
            {
                id: generateQueryId('analytics', 'predictive_risk_scores'),
                title: 'Predictive Risk Score Analysis',
                sql: `SELECT 
    risk_level,
    COUNT(*) as patient_count,
    AVG(age) as avg_age,
    AVG(risk_score) as avg_risk_score,
    SUM(CASE WHEN readmitted = 1 THEN 1 ELSE 0 END) as readmissions,
    SUM(CASE WHEN incident_occurred = 1 THEN 1 ELSE 0 END) as incidents
FROM risk_assessment
WHERE assessment_date >= DATE('now', '-365 days')
GROUP BY risk_level
ORDER BY avg_risk_score DESC;`,
                section: 'analytics',
                type: 'complex',
                description: 'Analyze predictive risk scores and outcomes'
            }
        ]
    };
    
    return demoQueries[section] || [];
}

// Update loading progress
function updateLoadingProgress(filename, count) {
    const progressFill = document.getElementById('progress-fill');
    const loadingFiles = document.getElementById('loading-files');
    
    if (progressFill && loadingFiles) {
        const loaded = queryLibrary.length;
        const totalEstimate = 40; // Estimate 40 total queries
        
        const progress = Math.min((loaded / totalEstimate) * 100, 100);
        progressFill.style.width = `${progress}%`;
        
        loadingFiles.innerHTML += `<div>✓ Loaded ${count} queries from ${filename}</div>`;
    }
}

// Initialize library UI
function initializeLibraryUI() {
    // Set up event listeners
    document.getElementById('query-search').addEventListener('input', searchQueries);
    document.getElementById('query-type-filter').addEventListener('change', filterByType);
    document.getElementById('sort-by').addEventListener('change', sortQueries);
    
    // Initialize view mode
    document.getElementById('queries-container').className = 'queries-container grid-view';
}

// Display queries
function displayQueries() {
    const container = document.getElementById('queries-container');
    
    if (queryLibrary.length === 0) {
        container.innerHTML = `
            <div class="empty-library">
                <i class="fas fa-database" style="font-size: 48px; color: #9ca3af; margin-bottom: 20px;"></i>
                <h3>No queries found</h3>
                <p>Make sure your SQL files are in the same directory:</p>
                <ul style="text-align: left; display: inline-block; margin: 10px 0;">
                    <li>section1_demographics.sql</li>
                    <li>section2_mental_health.sql</li>
                    <li>section3_criminal_history.sql</li>
                    <li>section4_performance.sql</li>
                    <li>section5_analytics.sql</li>
                </ul>
                <button onclick="loadDemoQueries()" class="btn btn-primary" style="margin-top: 20px;">
                    <i class="fas fa-play-circle"></i> Load Demo Queries
                </button>
            </div>
        `;
        return;
    }
    
    // Filter queries
    let filteredQueries = filterQueriesList();
    
    // Sort queries
    filteredQueries = sortQueriesList(filteredQueries);
    
    // Update showing count
    document.getElementById('showing-count').textContent = filteredQueries.length;
    
    // Render queries
    if (currentView === 'grid') {
        renderGridView(filteredQueries);
    } else {
        renderListView(filteredQueries);
    }
}

// Filter queries based on current filters
function filterQueriesList() {
    return queryLibrary.filter(query => {
        // Filter by section
        if (currentSection !== 'all' && query.section !== currentSection) {
            return false;
        }
        
        // Filter by type
        if (currentTypeFilter !== 'all' && query.type !== currentTypeFilter) {
            return false;
        }
        
        // Filter by search
        if (currentSearch) {
            const searchLower = currentSearch.toLowerCase();
            return (
                query.title.toLowerCase().includes(searchLower) ||
                query.sql.toLowerCase().includes(searchLower) ||
                query.description.toLowerCase().includes(searchLower) ||
                query.section.toLowerCase().includes(searchLower)
            );
        }
        
        return true;
    });
}

// Sort queries
function sortQueriesList(queries) {
    return queries.sort((a, b) => {
        switch (currentSort) {
            case 'name':
                return a.title.localeCompare(b.title);
            case 'type':
                return a.type.localeCompare(b.type);
            case 'usage':
                return (b.usageCount || 0) - (a.usageCount || 0);
            case 'section':
            default:
                const sectionOrder = ['demographics', 'mental_health', 'criminal_history', 'performance', 'analytics'];
                const aIndex = sectionOrder.indexOf(a.section);
                const bIndex = sectionOrder.indexOf(b.section);
                if (aIndex === bIndex) {
                    return a.title.localeCompare(b.title);
                }
                return aIndex - bIndex;
        }
    });
}

// Render grid view
function renderGridView(queries) {
    const container = document.getElementById('queries-container');
    container.className = 'queries-container grid-view';
    
    container.innerHTML = queries.map(query => `
        <div class="query-card section-${query.section}" onclick="useQuery('${query.id}')" 
             title="Click to use this query in editor">
            <div class="query-header">
                <div class="query-title">${escapeHtml(query.title)}</div>
                <div class="query-badges">
                    <span class="query-section-badge">
                        <i class="fas fa-${getSectionIcon(query.section)}"></i>
                        ${formatSectionName(query.section)}
                    </span>
                    <span class="query-type-badge">${query.type.toUpperCase()}</span>
                </div>
            </div>
            
            ${query.description ? `
            <div class="query-description">
                ${escapeHtml(query.description)}
            </div>
            ` : ''}
            
            <div class="query-sql" title="${escapeHtml(query.sql)}">
                ${escapeHtml(truncateSQL(query.sql, 150))}
            </div>
            
            <div class="query-footer">
                <div class="query-usage">
                    <i class="fas fa-play-circle"></i>
                    <span>Used ${query.usageCount || 0} times</span>
                    ${query.lastUsed ? `
                    <span class="last-used" title="Last used: ${formatDate(query.lastUsed)}">
                        <i class="fas fa-clock"></i> ${formatRelativeTime(query.lastUsed)}
                    </span>
                    ` : ''}
                </div>
                <div class="query-actions">
                    <button class="action-btn" onclick="event.stopPropagation(); editQuery('${query.id}')" 
                            title="Edit query">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" onclick="event.stopPropagation(); copyQuery('${query.id}')" 
                            title="Copy to clipboard">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn" onclick="event.stopPropagation(); favoriteQuery('${query.id}')" 
                            title="Add to favorites">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Render list view
function renderListView(queries) {
    const container = document.getElementById('queries-container');
    container.className = 'queries-container list-view';
    
    container.innerHTML = queries.map(query => `
        <div class="query-card section-${query.section}" onclick="useQuery('${query.id}')">
            <div class="query-content">
                <div class="query-title">${escapeHtml(query.title)}</div>
                <div class="query-sql">${escapeHtml(truncateSQL(query.sql, 100))}</div>
                <div class="query-meta">
                    <span class="query-section-badge">
                        <i class="fas fa-${getSectionIcon(query.section)}"></i>
                        ${formatSectionName(query.section)}
                    </span>
                    <span class="query-type-badge" style="margin-left: 8px;">${query.type.toUpperCase()}</span>
                </div>
            </div>
            <div class="query-actions">
                <button class="action-btn" onclick="event.stopPropagation(); editQuery('${query.id}')" 
                        title="Edit query">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn" onclick="event.stopPropagation(); copyQuery('${query.id}')" 
                        title="Copy to clipboard">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Use a query
function useQuery(queryId) {
    const query = queryLibrary.find(q => q.id === queryId);
    if (!query) return;
    
    // Put query in editor
    document.getElementById('sql-query').value = query.sql;
    
    // Update usage statistics
    query.usageCount = (query.usageCount || 0) + 1;
    query.lastUsed = new Date().toISOString();
    
    // Save to localStorage
    saveQueriesToStorage();
    
    // Show notification
    showNotification(`Loaded query: ${query.title}`, 'success');
    
    // Optional: Auto-execute
    // executeQuery();
}
// Filter by section
function filterBySection(section) {
    currentSection = section;
    
    // Update active tab
    document.querySelectorAll('.section-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent.toLowerCase().includes(section) || 
            (section === 'all' && tab.textContent.includes('All Sections'))) {
            tab.classList.add('active');
        }
    });
    
    // Update current section display
    const sectionName = section === 'all' ? 'All Sections' : formatSectionName(section);
    document.getElementById('current-section').textContent = sectionName;
    
    displayQueries();
}

// Filter by query type
function filterByType() {
    currentTypeFilter = document.getElementById('query-type-filter').value;
    displayQueries();
}

// Sort queries
function sortQueries() {
    currentSort = document.getElementById('sort-by').value;
    displayQueries();
}

// Search queries
function searchQueries() {
    currentSearch = document.getElementById('query-search').value;
    displayQueries();
}

// Toggle view mode
function toggleViewMode(mode) {
    currentView = mode;
    
    // Update active view button
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (mode === 'grid') {
        document.querySelector('.view-btn[title="Grid View"]').classList.add('active');
    } else {
        document.querySelector('.view-btn[title="List View"]').classList.add('active');
    }
    
    displayQueries();
}

// Update query statistics
function updateQueryStatistics() {
    const totalQueries = queryLibrary.length;
    const showingCount = filterQueriesList().length;
    
    document.getElementById('total-queries-count').textContent = totalQueries;
    document.getElementById('showing-count').textContent = showingCount;
    
    // Calculate section breakdown
    const sectionCounts = {};
    queryLibrary.forEach(query => {
        sectionCounts[query.section] = (sectionCounts[query.section] || 0) + 1;
    });
}

// Format section name
function formatSectionName(section) {
    const names = {
        'demographics': 'Demographics',
        'mental_health': 'Mental Health',
        'criminal_history': 'Criminal History',
        'performance': 'Performance',
        'analytics': 'Analytics'
    };
    return names[section] || section.replace('_', ' ').toUpperCase();
}

// Get section icon
function getSectionIcon(section) {
    const icons = {
        'demographics': 'users',
        'mental_health': 'brain',
        'criminal_history': 'gavel',
        'performance': 'chart-line',
        'analytics': 'chart-bar'
    };
    return icons[section] || 'database';
}

// Truncate SQL for display
function truncateSQL(sql, maxLength) {
    if (sql.length <= maxLength) return sql;
    return sql.substring(0, maxLength) + '...';
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Format relative time
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Edit a query
function editQuery(queryId) {
    const query = queryLibrary.find(q => q.id === queryId);
    if (!query) return;
    
    const newTitle = prompt('Edit query title:', query.title);
    if (newTitle === null) return;
    
    const newSQL = prompt('Edit SQL query:', query.sql);
    if (newSQL === null) return;
    
    const newDescription = prompt('Edit description (optional):', query.description || '');
    
    query.title = newTitle;
    query.sql = newSQL;
    query.description = newDescription;
    query.type = determineQueryType(newSQL);
    
    saveQueriesToStorage();
    displayQueries();
    showNotification('Query updated successfully', 'success');
}

// Copy query to clipboard
function copyQuery(queryId) {
    const query = queryLibrary.find(q => q.id === queryId);
    if (!query) return;
    
    navigator.clipboard.writeText(query.sql).then(() => {
        showNotification('Query copied to clipboard', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy to clipboard', 'error');
    });
}

// Toggle favorite status
function favoriteQuery(queryId) {
    const query = queryLibrary.find(q => q.id === queryId);
    if (!query) return;
    
    query.isFavorite = !query.isFavorite;
    saveQueriesToStorage();
    displayQueries();
    
    const action = query.isFavorite ? 'added to' : 'removed from';
    showNotification(`Query ${action} favorites`, 'info');
}

// Save current query to library
function saveCurrentQuery() {
    const sql = document.getElementById('sql-query').value.trim();
    if (!sql) {
        showNotification('Please enter a query first', 'warning');
        return;
    }
    
    const title = prompt('Enter a name for this query:', 
        `Saved Query ${queryLibrary.length + 1}`);
    if (!title) return;
    
    const description = prompt('Enter a description (optional):', '');
    const section = prompt('Select section:', 'demographics');
    
    const newQuery = {
        id: generateQueryId(section, title),
        title: title,
        sql: sql,
        section: section,
        type: determineQueryType(sql),
        description: description,
        usageCount: 0,
        lastUsed: null,
        sourceFile: 'manual_save',
        createdAt: new Date().toISOString(),
        isFavorite: false
    };
    
    queryLibrary.push(newQuery);
    saveQueriesToStorage();
    displayQueries();
    
    showNotification(`Query saved to ${formatSectionName(section)} section`, 'success');
}

// Show all queries in editor (for debugging)
function showAllQueriesInEditor() {
    let allQueries = '-- All Queries from MHC Database\n\n';
    
    queryLibrary.forEach((query, index) => {
        allQueries += `-- Query ${index + 1}: ${query.title}\n`;
        allQueries += `-- Section: ${formatSectionName(query.section)}\n`;
        if (query.description) {
            allQueries += `-- Description: ${query.description}\n`;
        }
        allQueries += query.sql + '\n\n';
    });
    
    document.getElementById('sql-query').value = allQueries;
    showNotification('All queries loaded into editor', 'info');
}

// Refresh query library
async function refreshQueryLibrary() {
    showNotification('Reloading queries from SQL files...', 'info');
    
    // Clear current library
    queryLibrary = [];
    
    // Reload from files
    await initializeQueryLibrary();
    
    showNotification('Query library refreshed successfully', 'success');
}

// Load demo queries
function loadDemoQueries() {
    const sections = ['demographics', 'mental_health', 'criminal_history', 'performance', 'analytics'];
    
    sections.forEach(section => {
        const demoQueries = createDemoQueriesForSection(section);
        queryLibrary = [...queryLibrary, ...demoQueries];
    });
    
    saveQueriesToStorage();
    displayQueries();
    updateQueryStatistics();
    
    showNotification('Loaded demo queries for all sections', 'success');
}

// Save queries to localStorage
function saveQueriesToStorage() {
    try {
        localStorage.setItem('mhc_query_library_v2', JSON.stringify(queryLibrary));
    } catch (error) {
        console.error('Could not save queries:', error);
    }
}

// Load saved queries from localStorage
function loadSavedQueries() {
    try {
        const saved = localStorage.getItem('mhc_query_library_v2');
        if (saved) {
            const savedQueries = JSON.parse(saved);
            
            // Only add saved queries that don't already exist
            savedQueries.forEach(savedQuery => {
                if (!queryLibrary.some(q => q.id === savedQuery.id)) {
                    queryLibrary.push(savedQuery);
                }
            });
            
            console.log(`Loaded ${savedQueries.length} saved queries from localStorage`);
        }
    } catch (error) {
        console.error('Could not load saved queries:', error);
    }
}

// Export queries to file
function exportQueriesToFile() {
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalQueries: queryLibrary.length,
        queries: queryLibrary
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = window.URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mhc_queries_export_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    
    showNotification(`Exported ${queryLibrary.length} queries`, 'success');
}

// Import queries from file
async function importQueriesFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                const importedQueries = importedData.queries || [];
                
                let addedCount = 0;
                importedQueries.forEach(query => {
                    if (!queryLibrary.some(q => q.id === query.id)) {
                        queryLibrary.push(query);
                        addedCount++;
                    }
                });
                
                saveQueriesToStorage();
                displayQueries();
                updateQueryStatistics();
                
                resolve(addedCount);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
document.addEventListener('DOMContentLoaded', async function() {
    console.log('MHC Database Dashboard Initializing...');
    
    // Set current year
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Update time
    updateTime();
    setInterval(updateTime, 1000);
    
    try {
        // Initialize database connection
        await initializeDatabase();
        
        // Initialize query library
        await initializeQueryLibrary();
        
        // Analyze database schema automatically
        setTimeout(async () => {
            try {
                await analyzeDatabaseSchema();
                showNotification(`Database schema loaded: ${Object.keys(databaseSchema).length} tables found`, 'success');
            } catch (error) {
                console.warn('Could not auto-analyze schema:', error);
                // Continue without schema analysis
            }
        }, 1000);
        
        // Load initial data
        await loadTables();
        await loadDatabaseStats();
        
        showNotification('MHC Database Dashboard ready!', 'success');
        
    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('Failed to initialize dashboard', 'error');
    }
});
// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    console.log('MHC Database Dashboard Initializing...');
    
    // Set current year
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Update time
    updateTime();
    setInterval(updateTime, 1000);
    
    try {
        // Initialize database connection
        await initializeDatabase();
        
        // Initialize query library
        await initializeQueryLibrary();
        
        // Load initial data
        await loadTables();
        await loadDatabaseStats();
        
        // Set up query preset handler
        document.getElementById('query-presets').addEventListener('change', function(e) {
            if (e.target.value) {
                document.getElementById('sql-query').value = e.target.value;
            }
        });
        
        // Add export button to preset dropdown
        const presetSelect = document.getElementById('query-presets');
        const exportOption = new Option('--- Export All Queries ---', 'export_all');
        presetSelect.add(exportOption);
        
        presetSelect.addEventListener('change', function(e) {
            if (e.target.value === 'export_all') {
                exportQueriesToFile();
                e.target.value = '';
            }
        });
        
        showNotification('MHC Database Dashboard ready!', 'success');
        
    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('Failed to initialize dashboard', 'error');
    }
});

// File import handler (for drag and drop or file input)
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
        showNotification('Please import a JSON file', 'error');
        return;
    }
    
    importQueriesFromFile(file)
        .then(count => {
            showNotification(`Imported ${count} new queries`, 'success');
        })
        .catch(error => {
            console.error('Import error:', error);
            showNotification('Failed to import queries', 'error');
        });
}

// Create file import button
function createFileImportButton() {
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json';
    importInput.style.display = 'none';
    importInput.id = 'import-file-input';
    importInput.onchange = handleFileImport;
    
    document.body.appendChild(importInput);
    
    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-info';
    importBtn.innerHTML = '<i class="fas fa-file-import"></i> Import from File';
    importBtn.onclick = () => document.getElementById('import-file-input').click();
    
    // Add to library actions
    const actionsDiv = document.querySelector('.library-actions');
    if (actionsDiv) {
        actionsDiv.insertBefore(importBtn, actionsDiv.firstChild);
    }
}

// Update time display
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const dateString = now.toLocaleDateString();
    
    const updateElement = document.getElementById('update-time');
    if (updateElement) {
        updateElement.textContent = `${dateString} ${timeString}`;
    }
}

// Add CSS for notifications
const notificationCSS = `
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 10000;
    transform: translateX(120%);
    opacity: 0;
    transition: all 0.3s ease;
    min-width: 300px;
    max-width: 400px;
}

.notification.show {
    transform: translateX(0);
    opacity: 1;
}

.notification i {
    font-size: 18px;
}

.notification-success {
    border-left: 4px solid #10b981;
    color: #065f46;
}

.notification-success i {
    color: #10b981;
}

.notification-warning {
    border-left: 4px solid #f59e0b;
    color: #92400e;
}

.notification-warning i {
    color: #f59e0b;
}

.notification-info {
    border-left: 4px solid #3b82f6;
    color: #1e40af;
}

.notification-info i {
    color: #3b82f6;
}

.notification-error {
    border-left: 4px solid #ef4444;
    color: #991b1b;
}

.notification-error i {
    color: #ef4444;
}
`;

// Add notification CSS to page
const styleSheet = document.createElement("style");
styleSheet.textContent = notificationCSS;
document.head.appendChild(styleSheet);

// Add file import button when library is ready
setTimeout(createFileImportButton, 1000);
// Database schema analysis
let databaseSchema = null;

// Show database schema
async function showDatabaseSchema() {
    const container = document.getElementById('schema-container');
    container.innerHTML = '<div class="loading">Analyzing database schema...</div>';
    
    try {
        await analyzeDatabaseSchema();
        displayDatabaseSchema();
    } catch (error) {
        container.innerHTML = `
            <div class="no-data" style="color: red;">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Schema Analysis Failed</h3>
                <p>${error.message}</p>
                <button onclick="loadMockSchema()" class="btn btn-secondary" style="margin-top: 10px;">
                    Load Mock Schema for Testing
                </button>
            </div>
        `;
    }
}

// Analyze database schema
async function analyzeDatabaseSchema() {
    if (!db) {
        throw new Error('Database not connected');
    }
    
    databaseSchema = {};
    
    try {
        // Get all tables
        const tablesResult = db.exec(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);
        
        if (tablesResult.length === 0) {
            throw new Error('No tables found in database');
        }
        
        const tables = tablesResult[0].values.map(row => row[0]);
        
        for (const tableName of tables) {
            try {
                // Get table info
                const tableInfo = db.exec(`PRAGMA table_info("${tableName}")`);
                const columns = tableInfo[0].values.map(row => ({
                    name: row[1],
                    type: row[2],
                    notnull: row[3],
                    dflt_value: row[4],
                    pk: row[5]
                }));
                
                // Get row count
                let rowCount = 0;
                try {
                    const countResult = db.exec(`SELECT COUNT(*) as count FROM "${tableName}"`);
                    rowCount = countResult[0].values[0][0];
                } catch (e) {
                    console.warn(`Could not count rows for ${tableName}:`, e);
                }
                
                databaseSchema[tableName] = {
                    columns: columns,
                    rowCount: rowCount,
                    sampleData: null
                };
                
                // Try to get sample data
                try {
                    const sampleResult = db.exec(`SELECT * FROM "${tableName}" LIMIT 3`);
                    if (sampleResult.length > 0) {
                        databaseSchema[tableName].sampleData = sampleResult[0].values;
                        databaseSchema[tableName].columnNames = sampleResult[0].columns;
                    }
                } catch (e) {
                    // Skip sample data if not accessible
                }
                
            } catch (error) {
                console.error(`Error analyzing table ${tableName}:`, error);
                databaseSchema[tableName] = {
                    columns: [],
                    rowCount: 0,
                    error: error.message
                };
            }
        }
        
        console.log('Database schema analyzed:', databaseSchema);
        
    } catch (error) {
        console.error('Schema analysis failed:', error);
        throw error;
    }
}

// Display database schema
function displayDatabaseSchema() {
    const container = document.getElementById('schema-container');
    
    if (!databaseSchema || Object.keys(databaseSchema).length === 0) {
        container.innerHTML = '<div class="no-data">No tables found in database</div>';
        return;
    }
    
    let html = `<h3>Found ${Object.keys(databaseSchema).length} tables:</h3>`;
    
    Object.entries(databaseSchema).forEach(([tableName, tableInfo]) => {
        html += `
            <div class="table-schema">
                <div class="table-header">
                    <div class="table-name">
                        <i class="fas fa-table"></i> ${tableName}
                    </div>
                    <div class="table-rows">
                        ${tableInfo.rowCount.toLocaleString()} rows
                    </div>
                </div>
                
                ${tableInfo.error ? `
                    <div class="error" style="color: red; padding: 10px; background: #fee2e2; border-radius: 4px;">
                        Error: ${tableInfo.error}
                    </div>
                ` : `
                    <div class="columns-list">
                        ${tableInfo.columns.map(col => `
                            <div class="column-item">
                                <div class="column-name">${col.name}</div>
                                <div class="column-type">${col.type} ${col.pk ? '🔑' : ''} ${col.notnull ? 'NOT NULL' : ''}</div>
                            </div>
                        `).join('')}
                    </div>
                    
                    ${tableInfo.sampleData ? `
                        <div class="sample-data" style="margin-top: 15px;">
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">
                                <i class="fas fa-eye"></i> Sample Data (first 3 rows):
                            </div>
                            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; font-size: 12px; font-family: monospace; max-height: 150px; overflow: auto;">
                                <table style="width: 100%;">
                                    <tr>
                                        ${tableInfo.columnNames.map(col => `<th style="text-align: left; padding: 2px 5px;">${col}</th>`).join('')}
                                    </tr>
                                    ${tableInfo.sampleData.map(row => `
                                        <tr>
                                            ${row.map(cell => `<td style="padding: 2px 5px; border-top: 1px solid #e5e7eb;">${cell || '<span style="color: #999;">NULL</span>'}</td>`).join('')}
                                        </tr>
                                    `).join('')}
                                </table>
                            </div>
                        </div>
                    ` : ''}
                `}
            </div>
        `;
    });
    
    // Add query validator
    html += `
        <div class="query-validator">
            <h4><i class="fas fa-check-circle"></i> Query Validator</h4>
            <p>Test if a query works with your database schema:</p>
            <textarea class="validator-input" id="validator-input" placeholder="Paste your SQL query here..." rows="4"></textarea>
            <button onclick="validateQuery()" class="btn btn-primary">
                <i class="fas fa-play"></i> Validate Query
            </button>
            <div id="validator-result" class="validator-result"></div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Validate a query against database schema
function validateQuery() {
    const queryInput = document.getElementById('validator-input');
    const resultDiv = document.getElementById('validator-result');
    const query = queryInput.value.trim();
    
    if (!query) {
        showNotification('Please enter a query to validate', 'warning');
        return;
    }
    
    if (!databaseSchema) {
        showNotification('Please analyze database schema first', 'warning');
        return;
    }
    
    resultDiv.className = 'validator-result';
    resultDiv.innerHTML = '<div class="loading">Validating query...</div>';
    resultDiv.classList.add('show');
    
    setTimeout(() => {
        try {
            // Extract table names from query
            const tableNames = extractTableNames(query);
            const columnNames = extractColumnNames(query);
            
            let isValid = true;
            let issues = [];
            let suggestions = [];
            
            // Check if tables exist
            tableNames.forEach(tableName => {
                if (!databaseSchema[tableName]) {
                    isValid = false;
                    issues.push(`Table "${tableName}" does not exist in database`);
                    
                    // Find similar table names
                    const similarTables = Object.keys(databaseSchema).filter(t => 
                        t.toLowerCase().includes(tableName.toLowerCase()) ||
                        tableName.toLowerCase().includes(t.toLowerCase())
                    );
                    
                    if (similarTables.length > 0) {
                        suggestions.push(`Did you mean: ${similarTables.join(', ')}?`);
                    }
                }
            });
            
            // Check if columns exist in tables
            columnNames.forEach(columnInfo => {
                const { table, column } = columnInfo;
                if (table && databaseSchema[table]) {
                    const columnExists = databaseSchema[table].columns.some(col => 
                        col.name.toLowerCase() === column.toLowerCase()
                    );
                    
                    if (!columnExists) {
                        isValid = false;
                        issues.push(`Column "${column}" does not exist in table "${table}"`);
                        
                        // Find similar columns
                        const similarColumns = databaseSchema[table].columns
                            .filter(col => col.name.toLowerCase().includes(column.toLowerCase()))
                            .map(col => col.name);
                        
                        if (similarColumns.length > 0) {
                            suggestions.push(`In table "${table}", did you mean: ${similarColumns.join(', ')}?`);
                        }
                    }
                }
            });
            
            // Try to execute the query
            try {
                if (db) {
                    const testResult = db.exec(query + ' LIMIT 1');
                    if (testResult) {
                        issues.push('✓ Query syntax is valid');
                    }
                }
            } catch (execError) {
                isValid = false;
                issues.push(`Execution error: ${execError.message}`);
            }
            
            // Display results
            if (isValid) {
                resultDiv.className = 'validator-result success show';
                resultDiv.innerHTML = `
                    <h5><i class="fas fa-check"></i> Query is valid!</h5>
                    <p>All tables and columns exist in the database.</p>
                    <button onclick="document.getElementById('sql-query').value = document.getElementById('validator-input').value; showNotification('Query copied to editor', 'success');" class="btn btn-small" style="margin-top: 10px;">
                        <i class="fas fa-code"></i> Use in Editor
                    </button>
                `;
            } else {
                resultDiv.className = 'validator-result error show';
                let html = `<h5><i class="fas fa-exclamation-triangle"></i> Found ${issues.length} issues:</h5><ul>`;
                
                issues.forEach(issue => {
                    html += `<li>${issue}</li>`;
                });
                
                if (suggestions.length > 0) {
                    html += `</ul><h6>Suggestions:</h6><ul>`;
                    suggestions.forEach(suggestion => {
                        html += `<li>${suggestion}</li>`;
                    });
                }
                
                html += `</ul>`;
                
                // Show actual tables/columns
                html += `<div style="margin-top: 15px; font-size: 12px;">
                    <strong>Available in your database:</strong><br>`;
                
                Object.entries(databaseSchema).forEach(([tableName, tableInfo]) => {
                    html += `<div style="margin-top: 5px;">
                        <strong>${tableName}:</strong> ${tableInfo.columns.map(col => col.name).join(', ')}
                    </div>`;
                });
                
                html += `</div>`;
                
                resultDiv.innerHTML = html;
            }
            
        } catch (error) {
            resultDiv.className = 'validator-result error show';
            resultDiv.innerHTML = `
                <h5><i class="fas fa-exclamation-triangle"></i> Validation Error</h5>
                <p>${error.message}</p>
            `;
        }
    }, 500);
}

// Extract table names from SQL query
function extractTableNames(query) {
    const tableNames = new Set();
    const upperQuery = query.toUpperCase();
    
    // Look for FROM clauses
    const fromMatches = query.match(/FROM\s+([^\s,(]+)/gi) || [];
    fromMatches.forEach(match => {
        const table = match.replace(/FROM\s+/i, '').replace(/["'`]/g, '').trim();
        if (table && !table.includes('(') && !table.includes('SELECT')) {
            tableNames.add(table);
        }
    });
    
    // Look for JOIN clauses
    const joinMatches = query.match(/JOIN\s+([^\s,(]+)/gi) || [];
    joinMatches.forEach(match => {
        const table = match.replace(/JOIN\s+/i, '').replace(/["'`]/g, '').trim();
        if (table && !table.includes('(') && !table.includes('SELECT')) {
            tableNames.add(table);
        }
    });
    
    // Look for INSERT INTO
    const insertMatches = query.match(/INSERT\s+INTO\s+([^\s,(]+)/gi) || [];
    insertMatches.forEach(match => {
        const table = match.replace(/INSERT\s+INTO\s+/i, '').replace(/["'`]/g, '').trim();
        if (table) {
            tableNames.add(table);
        }
    });
    
    // Look for UPDATE
    const updateMatches = query.match(/UPDATE\s+([^\s,(]+)/gi) || [];
    updateMatches.forEach(match => {
        const table = match.replace(/UPDATE\s+/i, '').replace(/["'`]/g, '').trim();
        if (table) {
            tableNames.add(table);
        }
    });
    
    return Array.from(tableNames);
}

// Extract column names from SQL query
function extractColumnNames(query) {
    const columnInfo = [];
    const upperQuery = query.toUpperCase();
    
    // Remove strings and comments for better parsing
    let cleanQuery = query.replace(/--[^\n]*\n/g, '')
                         .replace(/\/\*.*?\*\//gs, '')
                         .replace(/'[^']*'/g, "''")
                         .replace(/"[^"]*"/g, '""');
    
    // Look for column references with table prefixes
    const columnMatches = cleanQuery.match(/(\w+)\.(\w+)/g) || [];
    columnMatches.forEach(match => {
        const parts = match.split('.');
        if (parts.length === 2) {
            columnInfo.push({
                table: parts[0],
                column: parts[1]
            });
        }
    });
    
    return columnInfo;
}

// Test all queries against database
async function testAllQueries() {
    if (queryLibrary.length === 0) {
        showNotification('No queries loaded yet', 'warning');
        return;
    }
    
    const container = document.getElementById('schema-container');
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Testing ${queryLibrary.length} queries against database...</p>
            <div id="test-progress" style="width: 100%; background: #e5e7eb; border-radius: 10px; height: 20px; margin-top: 20px;">
                <div id="progress-bar" style="width: 0%; height: 100%; background: #667eea; border-radius: 10px; transition: width 0.3s;"></div>
            </div>
            <div id="test-results" style="margin-top: 20px;"></div>
        </div>
    `;
    
    const results = [];
    const total = queryLibrary.length;
    
    for (let i = 0; i < total; i++) {
        const query = queryLibrary[i];
        
        // Update progress
        const progress = ((i + 1) / total) * 100;
        document.getElementById('progress-bar').style.width = `${progress}%`;
        
        try {
            // Try to execute the query with LIMIT 1 for safety
            let testQuery = query.sql;
            if (testQuery.toUpperCase().startsWith('SELECT')) {
                if (!testQuery.toUpperCase().includes('LIMIT')) {
                    testQuery += ' LIMIT 1';
                }
            }
            
            const startTime = performance.now();
            const result = db.exec(testQuery);
            const endTime = performance.now();
            
            results.push({
                query: query.title,
                success: true,
                time: endTime - startTime,
                rows: result.length > 0 ? result[0].values.length : 0,
                message: '✓ Query executed successfully'
            });
            
        } catch (error) {
            results.push({
                query: query.title,
                success: false,
                time: 0,
                rows: 0,
                message: `✗ ${error.message}`
            });
        }
        
        // Update results display every 5 queries
        if ((i + 1) % 5 === 0 || i === total - 1) {
            updateTestResultsDisplay(results);
        }
    }
}

// Update test results display
function updateTestResultsDisplay(results) {
    const resultsDiv = document.getElementById('test-results');
    if (!resultsDiv) return;
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    let html = `
        <div style="margin-bottom: 15px;">
            <strong>Progress: ${successCount}/${totalCount} queries successful</strong>
        </div>
    `;
    
    results.slice(-5).forEach(result => {
        html += `
            <div class="test-result ${result.success ? 'test-success' : 'test-error'}">
                <strong>${result.query}:</strong> ${result.message}
                ${result.success ? ` (${result.rows} rows, ${Math.round(result.time)}ms)` : ''}
            </div>
        `;
    });
    
    resultsDiv.innerHTML = html;
}

// Auto-adapt queries to match database schema
function adaptQueriesToSchema() {
    if (!databaseSchema || Object.keys(databaseSchema).length === 0) {
        showNotification('Please analyze database schema first', 'warning');
        return;
    }
    
    if (queryLibrary.length === 0) {
        showNotification('No queries to adapt', 'warning');
        return;
    }
    
    const adaptedQueries = [];
    
    queryLibrary.forEach(originalQuery => {
        const adapted = adaptSingleQuery(originalQuery.sql);
        
        if (adapted.modified) {
            adaptedQueries.push({
                original: originalQuery.title,
                originalSQL: originalQuery.sql,
                adaptedSQL: adapted.sql,
                changes: adapted.changes
            });
            
            // Update the query in library
            originalQuery.sql = adapted.sql;
            originalQuery.title = `${originalQuery.title} (adapted)`;
            originalQuery.description = originalQuery.description ? 
                `${originalQuery.description}\n\nAdapted from original. Changes: ${adapted.changes.join(', ')}` :
                `Adapted from original. Changes: ${adapted.changes.join(', ')}`;
        }
    });
    
    // Save adapted queries
    saveQueriesToStorage();
    displayQueries();
    
    // Show adaptation report
    showAdaptationReport(adaptedQueries);
}

// Adapt a single query to match schema
function adaptSingleQuery(sql) {
    const changes = [];
    let adaptedSQL = sql;
    
    // Get all available table names
    const availableTables = Object.keys(databaseSchema);
    
    // Try to map table names
    availableTables.forEach(actualTable => {
        // Check for similar table names (case-insensitive partial matches)
        const pattern = new RegExp(`\\b${actualTable.split('_').join('[ _]?')}\\b`, 'gi');
        if (pattern.test(adaptedSQL) && !adaptedSQL.toLowerCase().includes(actualTable.toLowerCase())) {
            adaptedSQL = adaptedSQL.replace(pattern, actualTable);
            changes.push(`Table renamed to "${actualTable}"`);
        }
    });
    
    // For each table in query, check columns
    const tableNames = extractTableNames(adaptedSQL);
    tableNames.forEach(tableName => {
        if (databaseSchema[tableName]) {
            const tableColumns = databaseSchema[tableName].columns.map(col => col.name);
            
            // Simple column name mapping (could be enhanced)
            tableColumns.forEach(column => {
                const columnPattern = new RegExp(`\\b${column}\\b`, 'gi');
                if (columnPattern.test(adaptedSQL)) {
                    // Column exists, no change needed
                }
            });
        }
    });
    
    return {
        sql: adaptedSQL,
        modified: changes.length > 0,
        changes: changes
    };
}

// Show adaptation report
function showAdaptationReport(adaptedQueries) {
    const container = document.getElementById('schema-container');
    
    if (adaptedQueries.length === 0) {
        container.innerHTML = `
            <div class="no-data" style="color: green;">
                <i class="fas fa-check-circle"></i>
                <h3>No Adaptations Needed</h3>
                <p>All queries already match the database schema!</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px;">
            <h3><i class="fas fa-magic"></i> Adapted ${adaptedQueries.length} Queries</h3>
            <p>Changes made to match your database schema:</p>
    `;
    
    adaptedQueries.forEach((adapted, index) => {
        html += `
            <div style="background: white; padding: 15px; border-radius: 6px; margin: 10px 0; border: 1px solid #e5e7eb;">
                <h4>${adapted.original}</h4>
                <div style="display: flex; gap: 20px; margin-top: 10px;">
                    <div style="flex: 1;">
                        <strong>Original:</strong>
                        <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px; max-height: 150px; overflow: auto;">${escapeHtml(adapted.originalSQL.substring(0, 300))}${adapted.originalSQL.length > 300 ? '...' : ''}</pre>
                    </div>
                    <div style="flex: 1;">
                        <strong>Adapted:</strong>
                        <pre style="background: #d1fae5; padding: 10px; border-radius: 4px; font-size: 12px; max-height: 150px; overflow: auto;">${escapeHtml(adapted.adaptedSQL.substring(0, 300))}${adapted.adaptedSQL.length > 300 ? '...' : ''}</pre>
                    </div>
                </div>
                <div style="margin-top: 10px;">
                    <strong>Changes:</strong> ${adapted.changes.join(', ')}
                </div>
                <button onclick="document.getElementById('sql-query').value = \`${escapeHtml(adapted.adaptedSQL)}\`; showNotification('Adapted query loaded into editor', 'success');" 
                        class="btn btn-small" style="margin-top: 10px;">
                    <i class="fas fa-code"></i> Use Adapted Query
                </button>
            </div>
        `;
    });
    
    html += `
        <div style="margin-top: 20px; text-align: center;">
            <button onclick="showDatabaseSchema()" class="btn btn-primary">
                <i class="fas fa-eye"></i> View Database Schema Again
            </button>
        </div>
    </div>`;
    
    container.innerHTML = html;
}

// Load mock schema for testing
function loadMockSchema() {
    databaseSchema = {
        patients: {
            columns: [
                { name: 'id', type: 'INTEGER', pk: 1, notnull: 1 },
                { name: 'name', type: 'TEXT', pk: 0, notnull: 1 },
                { name: 'age', type: 'INTEGER', pk: 0, notnull: 0 },
                { name: 'gender', type: 'TEXT', pk: 0, notnull: 0 },
                { name: 'diagnosis', type: 'TEXT', pk: 0, notnull: 0 }
            ],
            rowCount: 125,
            sampleData: [
                [1, 'John Doe', 35, 'Male', 'Depression'],
                [2, 'Jane Smith', 42, 'Female', 'Anxiety'],
                [3, 'Bob Johnson', 28, 'Male', 'Bipolar']
            ],
            columnNames: ['id', 'name', 'age', 'gender', 'diagnosis']
        },
        treatment_sessions: {
            columns: [
                { name: 'session_id', type: 'INTEGER', pk: 1, notnull: 1 },
                { name: 'patient_id', type: 'INTEGER', pk: 0, notnull: 1 },
                { name: 'session_date', type: 'DATE', pk: 0, notnull: 1 },
                { name: 'progress_score', type: 'INTEGER', pk: 0, notnull: 0 }
            ],
            rowCount: 542,
            sampleData: [
                [1, 1, '2024-01-15', 75],
                [2, 1, '2024-01-22', 80],
                [3, 2, '2024-01-16', 65]
            ],
            columnNames: ['session_id', 'patient_id', 'session_date', 'progress_score']
        }
    };
    
    displayDatabaseSchema();
    showNotification('Loaded mock schema for testing', 'info');
}
// Debug function
async function debugDatabase() {
    console.log('=== DATABASE DEBUG INFO ===');
    
    // Check database connection
    console.log('Database connected:', !!db);
    
    // List all tables
    if (db) {
        try {
            const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            console.log('Tables in database:', tables[0]?.values?.map(row => row[0]) || []);
            
            // Show first few rows of first table
            if (tables.length > 0 && tables[0].values.length > 0) {
                const firstTable = tables[0].values[0][0];
                console.log(`Sample from ${firstTable}:`);
                try {
                    const sample = db.exec(`SELECT * FROM "${firstTable}" LIMIT 3`);
                    console.log(sample);
                } catch (e) {
                    console.log(`Cannot read ${firstTable}:`, e.message);
                }
            }
        } catch (error) {
            console.log('Cannot read tables:', error.message);
        }
    }
    
    // Check query library
    console.log('Queries loaded:', queryLibrary.length);
    queryLibrary.forEach((q, i) => {
        console.log(`${i+1}. ${q.title} (${q.section}) - ${q.sql.substring(0, 50)}...`);
    });
    
    // Show in UI
    const container = document.getElementById('schema-container') || document.body;
    const debugDiv = document.createElement('div');
    debugDiv.className = 'query-stats-details';
    debugDiv.innerHTML = `
        <h3>Debug Information</h3>
        <p><strong>Database Connected:</strong> ${!!db ? 'Yes' : 'No'}</p>
        <p><strong>Queries Loaded:</strong> ${queryLibrary.length}</p>
        <p><strong>Schema Analyzed:</strong> ${databaseSchema ? 'Yes' : 'No'}</p>
        <button onclick="this.parentElement.remove()" class="btn btn-small" style="margin-top: 10px;">Close</button>
    `;
    container.appendChild(debugDiv);
    
    console.log('=== END DEBUG ===');
}