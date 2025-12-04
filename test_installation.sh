#!/bin/bash
echo "Testing MHC Database Installation..."
echo "===================================="

if [ -f "MHC_Project.db" ]; then
    echo "✓ Database file found"
    PARTICIPANTS=$(sqlite3 MHC_Project.db "SELECT COUNT(*) FROM PARTICIPANT;" 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "✓ Database accessible: $PARTICIPANTS participants"
        
        # Test a query
        echo ""
        echo "Testing Section 1 Query 1.1:"
        echo "----------------------------"
        sqlite3 MHC_Project.db "SELECT 
            CASE 
                WHEN strftime('%Y', Start_Date) BETWEEN '2019' AND '2020' THEN 'FY19-20'
                WHEN strftime('%Y', Start_Date) = '2021' THEN 'FY21'
                WHEN strftime('%Y', Start_Date) = '2022' THEN 'FY22'
                WHEN strftime('%Y', Start_Date) = '2023' THEN 'FY23'
                WHEN strftime('%Y', Start_Date) = '2024' THEN 'FY24'
                WHEN strftime('%Y', Start_Date) = '2025' THEN 'FY25'
                ELSE 'Other'
            END as Fiscal_Year,
            COUNT(*) as Participant_Count
        FROM MHC_ENROLLMENT
        GROUP BY Fiscal_Year
        ORDER BY 
            CASE Fiscal_Year
                WHEN 'FY19-20' THEN 1
                WHEN 'FY21' THEN 2
                WHEN 'FY22' THEN 3
                WHEN 'FY23' THEN 4
                WHEN 'FY24' THEN 5
                WHEN 'FY25' THEN 6
                ELSE 7
            END;" 2>/dev/null
        
        echo ""
        echo "✅ Installation successful! Database is working."
        echo ""
        echo "To run all queries:"
        echo "  sqlite3 MHC_Project.db < sql_queries/section1_demographics.sql"
    else
        echo "✗ Error accessing database"
    fi
else
    echo "✗ Database file not found"
    echo "Make sure MHC_Project.db is in the current directory"
fi
