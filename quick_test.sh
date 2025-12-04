#!/bin/bash
echo "=== MHC Database Quick Test ==="
echo ""
echo "1. Checking files..."
ls -la *.db *.sql *.py *.txt *.md 2>/dev/null
echo ""
echo "2. Testing database..."
if [ -f "MHC_Project.db" ]; then
    sqlite3 MHC_Project.db << 'SQL'
SELECT 
    '✅ Database working!' as Status,
    COUNT(*) as Participants,
    (SELECT COUNT(*) FROM PARTICIPANT_CHARGE) as Charges,
    (SELECT COUNT(*) FROM TREATMENT_EPISODE) as Treatment_Episodes
FROM PARTICIPANT;
SQL
else
    echo "❌ MHC_Project.db not found!"
fi
echo ""
echo "3. Testing a sample query..."
if [ -f "sql_queries/section1_demographics.sql" ]; then
    echo "First 3 lines of section1 output:"
    sqlite3 MHC_Project.db < sql_queries/section1_demographics.sql | head -3
else
    echo "❌ SQL queries folder not found!"
fi
