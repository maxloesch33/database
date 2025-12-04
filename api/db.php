<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Database configuration
$host = 'localhost';
$dbname = 'your_database';
$username = 'your_username';
$password = 'your_password';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Handle different API endpoints
    $action = $_GET['action'] ?? '';
    
    switch ($action) {
        case 'execute':
            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $query = $data['query'] ?? '';
                
                if (empty($query)) {
                    echo json_encode(['error' => 'No query provided']);
                    exit;
                }
                
                // Security: Add query validation here
                $stmt = $pdo->query($query);
                
                if (strpos(strtoupper($query), 'SELECT') === 0) {
                    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    echo json_encode(['success' => true, 'data' => $results]);
                } else {
                    // For INSERT, UPDATE, DELETE
                    echo json_encode(['success' => true, 'affected_rows' => $stmt->rowCount()]);
                }
            }
            break;
            
        case 'tables':
            $stmt = $pdo->query("SHOW TABLES");
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            // Get row count for each table
            $tableData = [];
            foreach ($tables as $table) {
                $countStmt = $pdo->query("SELECT COUNT(*) as count FROM `$table`");
                $rowCount = $countStmt->fetch(PDO::FETCH_ASSOC)['count'];
                $tableData[] = ['name' => $table, 'rows' => $rowCount];
            }
            
            echo json_encode(['tables' => $tableData]);
            break;
            
        case 'stats':
            // Get total tables
            $stmt = $pdo->query("SHOW TABLES");
            $totalTables = count($stmt->fetchAll(PDO::FETCH_COLUMN));
            
            // Get database size
            $sizeStmt = $pdo->query("
                SELECT SUM(data_length + index_length) / 1024 / 1024 as size_mb 
                FROM information_schema.TABLES 
                WHERE table_schema = '$dbname'
            ");
            $dbSize = $sizeStmt->fetch(PDO::FETCH_ASSOC)['size_mb'];
            
            echo json_encode([
                'total_tables' => $totalTables,
                'db_size' => round($dbSize, 2),
                'query_count' => 0 // You would track this in a log table
            ]);
            break;
            
        default:
            echo json_encode(['error' => 'Invalid action']);
    }
    
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}