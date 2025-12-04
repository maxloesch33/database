-- ============================================
-- SECTION 3: Criminal History & Risk Assessment
-- ============================================

-- Query 3.1: LS/CMI Risk Distribution vs US Probation Norms
SELECT 
    ra.Risk_Category,
    COUNT(*) as Participant_Count,
    ROUND(AVG(ra.Risk_Score), 2) as Average_Score,
    CASE ra.Risk_Category
        WHEN 'Low' THEN '0-3 (US Norm: 23%)'
        WHEN 'Medium' THEN '4-6 (US Norm: 38%)'
        WHEN 'High' THEN '7-9 (US Norm: 28%)'
        WHEN 'Very High' THEN '10+ (US Norm: 11%)'
        ELSE 'Unknown'
    END as US_Probation_Norms
FROM RISK_ASSESSMENT ra
WHERE ra.Risk_Category IS NOT NULL AND ra.Risk_Score IS NOT NULL
GROUP BY ra.Risk_Category
ORDER BY 
    CASE ra.Risk_Category
        WHEN 'Low' THEN 1
        WHEN 'Medium' THEN 2
        WHEN 'High' THEN 3
        WHEN 'Very High' THEN 4
        ELSE 5
    END;

-- Query 3.2: Total Criminal History Before MHC
SELECT 
    'Before MHC Enrollment' as Period,
    COUNT(*) as Total_Charges,
    COUNT(DISTINCT pc.Participant_ID) as Participants_With_Charges,
    SUM(CASE WHEN pc.Outcome = 'Convicted' THEN 1 ELSE 0 END) as Total_Convictions,
    ROUND(AVG(CASE WHEN pc.Charge_Date < e.Start_Date THEN 1 ELSE 0 END) * 100, 2) as Percentage_Before_MHC
FROM PARTICIPANT_CHARGE pc
JOIN MHC_ENROLLMENT e ON pc.Participant_ID = e.Participant_ID
WHERE pc.Charge_Date IS NOT NULL AND e.Start_Date IS NOT NULL

UNION ALL

SELECT 
    'During MHC Enrollment',
    COUNT(*) as Total_Charges,
    COUNT(DISTINCT pc.Participant_ID),
    SUM(CASE WHEN pc.Outcome = 'Convicted' THEN 1 ELSE 0 END),
    ROUND(AVG(CASE WHEN pc.Charge_Date >= e.Start_Date AND (pc.Charge_Date <= e.End_Date OR e.End_Date IS NULL) THEN 1 ELSE 0 END) * 100, 2)
FROM PARTICIPANT_CHARGE pc
JOIN MHC_ENROLLMENT e ON pc.Participant_ID = e.Participant_ID
WHERE pc.Charge_Date IS NOT NULL AND e.Start_Date IS NOT NULL;

-- Query 3.3: Average Criminal History Per Participant
SELECT 
    'Charges Per Participant' as Metric,
    ROUND(AVG(Charge_Count), 2) as Average,
    MIN(Charge_Count) as Minimum,
    MAX(Charge_Count) as Maximum,
    SUM(Charge_Count) as Total
FROM (
    SELECT 
        pc.Participant_ID,
        COUNT(*) as Charge_Count
    FROM PARTICIPANT_CHARGE pc
    GROUP BY pc.Participant_ID
) as Participant_Charges

UNION ALL

SELECT 
    'Convictions Per Participant',
    ROUND(AVG(Conviction_Count), 2),
    MIN(Conviction_Count),
    MAX(Conviction_Count),
    SUM(Conviction_Count)
FROM (
    SELECT 
        pc.Participant_ID,
        SUM(CASE WHEN pc.Outcome = 'Convicted' THEN 1 ELSE 0 END) as Conviction_Count
    FROM PARTICIPANT_CHARGE pc
    GROUP BY pc.Participant_ID
) as Participant_Convictions;


-- Query 3.4: Risk Scores by Exit Status (Correlation Analysis)
SELECT 
    e.End_Status,
    COUNT(*) as Participant_Count,
    ROUND(AVG(ra.Risk_Score), 2) as Average_Risk_Score,
    MIN(ra.Risk_Score) as Min_Risk_Score,
    MAX(ra.Risk_Score) as Max_Risk_Score
FROM PARTICIPANT p
JOIN MHC_ENROLLMENT e ON p.Participant_ID = e.Participant_ID
LEFT JOIN RISK_ASSESSMENT ra ON p.Participant_ID = ra.Participant_ID
WHERE e.End_Status IS NOT NULL AND ra.Risk_Score IS NOT NULL
GROUP BY e.End_Status
ORDER BY Average_Risk_Score DESC;

-- Query 3.5: Criminal History by Program Outcomes
SELECT 
    co.Class as Offense_Class,
    COUNT(DISTINCT p.Participant_ID) as Total_Participants,
    SUM(CASE WHEN e.End_Status = 'Graduated' THEN 1 ELSE 0 END) as Graduated,
    SUM(CASE WHEN e.End_Status = 'Terminated' THEN 1 ELSE 0 END) as Terminated,
    ROUND(SUM(CASE WHEN e.End_Status = 'Graduated' THEN 1 ELSE 0 END) * 100.0 / 
          COUNT(DISTINCT p.Participant_ID), 2) as Graduation_Rate
FROM PARTICIPANT p
JOIN MHC_ENROLLMENT e ON p.Participant_ID = e.Participant_ID
JOIN PARTICIPANT_CHARGE pc ON p.Participant_ID = pc.Participant_ID
JOIN CHARGE_OFFENSE co ON pc.Offense_ID = co.Offense_ID
WHERE e.End_Status IN ('Graduated', 'Terminated')
  AND pc.Charge_Date < e.Start_Date  -- Only charges before MHC entry
GROUP BY co.Class
HAVING COUNT(DISTINCT p.Participant_ID) >= 5  -- Only significant groups
ORDER BY Total_Participants DESC;