# MHC Database Project - Phase 1&2 Submission
# Team: Paul Ficker, Joey Dukart, Rowan Shelhamer, Max Loesch, Bryce Douglas
# Due Date: December 4, 2024

## SUBMISSION CONTENTS:

### 1. Database Schema & Implementation
- `MHC_Schema_DDL.sql` - Complete database schema (10 tables)
- `data_loader.py` - Python script to load all 21 CSV files
- `schema_documentation.txt` - Comprehensive technical documentation

### 2. Analytical SQL Queries (42 Total)
- `sql_queries/section1_demographics.sql` - 6 queries
- `sql_queries/section2_mental_health.sql` - 8 queries  
- `sql_queries/section3_criminal_history.sql` - 5 queries
- `sql_queries/section4_performance.sql` - 9 queries
- `sql_queries/section5_analytics.sql` - 14 queries

### 3. Sample Outputs
- `query_samples.txt` - Sample query outputs demonstrating functionality

### 4. Database File (Optional)
- `MHC_Project.db` - Pre-loaded SQLite database (can be recreated using loader)

## HOW TO RUN:

### Option A: Use Pre-loaded Database
1. Use SQLite to open MHC_Project.db
2. Run queries: `sqlite3 MHC_Project.db < sql_queries/section1_demographics.sql`

### Option B: Recreate from Scratch
1. Create schema: `sqlite3 MHC_Project.db < MHC_Schema_DDL.sql`
2. Load data: `python3 data_loader.py`
3. Run queries as above

## KEY PROJECT REQUIREMENTS MET:

✓ 42 SQL queries extracting data for ALL MHC evaluation report graphs
✓ Database design following normalization principles (3NF)
✓ Comprehensive documentation including schema design
✓ Statistical accuracy matching original MHC report
✓ Web-ready query outputs for Phase 3 dashboard integration
✓ Support for all 5 analytical sections from project requirements

## CONTACT:
For questions about this submission, contact team members listed above.
## DATABASE INCLUDED:
- `MHC_Project.db` - Complete SQLite database (232KB) with all data loaded
- Contains: 87 participants, 1,931 charges, 272 treatment episodes
- Ready to query immediately - no setup required

## QUICK TEST:
sqlite3 MHC_Project.db "SELECT 'Success!' as Status, COUNT(*) as Participants FROM PARTICIPANT;"
