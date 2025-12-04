-- ============================================
-- SECTION 1: Participant Demographics & Entry
-- ============================================

-- Query 1.1: Entry Status Distribution by Fiscal Year
SELECT 
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
GROUP BY 
    CASE 
        WHEN strftime('%Y', Start_Date) BETWEEN '2019' AND '2020' THEN 'FY19-20'
        WHEN strftime('%Y', Start_Date) = '2021' THEN 'FY21'
        WHEN strftime('%Y', Start_Date) = '2022' THEN 'FY22'
        WHEN strftime('%Y', Start_Date) = '2023' THEN 'FY23'
        WHEN strftime('%Y', Start_Date) = '2024' THEN 'FY24'
        WHEN strftime('%Y', Start_Date) = '2025' THEN 'FY25'
        ELSE 'Other'
    END
ORDER BY 
    CASE 
        WHEN strftime('%Y', Start_Date) BETWEEN '2019' AND '2020' THEN 1
        WHEN strftime('%Y', Start_Date) = '2021' THEN 2
        WHEN strftime('%Y', Start_Date) = '2022' THEN 3
        WHEN strftime('%Y', Start_Date) = '2023' THEN 4
        WHEN strftime('%Y', Start_Date) = '2024' THEN 5
        WHEN strftime('%Y', Start_Date) = '2025' THEN 6
        ELSE 7
    END;



-- Query 1.2: Age & Gender Demographics at Program Entry
SELECT 
    CASE 
        WHEN UPPER(p.Gender) LIKE 'F%' THEN 'Female'
        WHEN UPPER(p.Gender) LIKE 'M%' THEN 'Male'
        ELSE 'Other'
    END as Gender_Cleaned,
    COUNT(*) as Participant_Count,
    ROUND(AVG(
        CAST((julianday(e.Start_Date) - julianday(p.Date_of_Birth)) / 365.25 AS INTEGER)
    ), 1) as Average_Age_At_Entry,
    MIN(
        CAST((julianday(e.Start_Date) - julianday(p.Date_of_Birth)) / 365.25 AS INTEGER)
    ) as Youngest_Age,
    MAX(
        CAST((julianday(e.Start_Date) - julianday(p.Date_of_Birth)) / 365.25 AS INTEGER)
    ) as Oldest_Age
FROM PARTICIPANT p
JOIN MHC_ENROLLMENT e ON p.Participant_ID = e.Participant_ID
WHERE p.Gender IS NOT NULL AND p.Date_of_Birth IS NOT NULL
GROUP BY 
    CASE 
        WHEN UPPER(p.Gender) LIKE 'F%' THEN 'Female'
        WHEN UPPER(p.Gender) LIKE 'M%' THEN 'Male'
        ELSE 'Other'
    END
ORDER BY Participant_Count DESC;


-- Query 1.3: Race/Ethnicity Equity Analysis
SELECT 
    p.Race_Ethnicity,
    COUNT(*) as Participant_Count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM PARTICIPANT WHERE Race_Ethnicity IS NOT NULL), 2) as Percentage
FROM PARTICIPANT p
WHERE p.Race_Ethnicity IS NOT NULL
GROUP BY p.Race_Ethnicity
ORDER BY Participant_Count DESC;


-- Query 1.4: Entry Offense Distribution (Most Common Charge Classes)
SELECT 
    co.Class,
    COUNT(*) as Total_Charges,
    COUNT(DISTINCT pc.Participant_ID) as Participants_With_This_Class,
    ROUND(COUNT(DISTINCT pc.Participant_ID) * 100.0 / 
          (SELECT COUNT(DISTINCT Participant_ID) FROM PARTICIPANT_CHARGE), 2) as Percentage_of_Participants
FROM PARTICIPANT_CHARGE pc
JOIN CHARGE_OFFENSE co ON pc.Offense_ID = co.Offense_ID
WHERE pc.Charge_Date IS NOT NULL
GROUP BY co.Class
ORDER BY Total_Charges DESC;


-- Query 1.5: Most Common Specific Offenses at Entry
SELECT 
    co.Offense_Name,
    co.Class,
    COUNT(*) as Frequency,
    COUNT(DISTINCT pc.Participant_ID) as Unique_Participants
FROM PARTICIPANT_CHARGE pc
JOIN CHARGE_OFFENSE co ON pc.Offense_ID = co.Offense_ID
GROUP BY co.Offense_Name, co.Class
ORDER BY Frequency DESC
LIMIT 15;


-- Query 1.6: Participant Demographics Summary
SELECT 
    'Total Participants' as Metric,
    COUNT(*) as Value
FROM PARTICIPANT

UNION ALL

SELECT 
    'Gender Ratio (Male:Female)',
    ROUND(
        (SELECT COUNT(*) FROM PARTICIPANT WHERE UPPER(Gender) LIKE 'M%') * 1.0 / 
        NULLIF((SELECT COUNT(*) FROM PARTICIPANT WHERE UPPER(Gender) LIKE 'F%'), 0), 
        2
    ) || ':1'

UNION ALL

SELECT 
    'Average Age at Entry',
    ROUND(AVG(
        CAST((julianday(e.Start_Date) - julianday(p.Date_of_Birth)) / 365.25 AS INTEGER)
    ), 1)
FROM PARTICIPANT p
JOIN MHC_ENROLLMENT e ON p.Participant_ID = e.Participant_ID
WHERE p.Date_of_Birth IS NOT NULL

UNION ALL

SELECT 
    'Earliest Enrollment',
    MIN(e.Start_Date)
FROM MHC_ENROLLMENT e

UNION ALL

SELECT 
    'Latest Enrollment',
    MAX(e.Start_Date)
FROM MHC_ENROLLMENT e

UNION ALL

SELECT 
    'Average Program Length (Days)',
    ROUND(AVG(e.Length_Days), 1)
FROM MHC_ENROLLMENT e
WHERE e.Length_Days IS NOT NULL;