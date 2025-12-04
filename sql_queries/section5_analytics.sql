-- ============================================
-- SECTION 5: Appendix & Detailed Analytics
-- ============================================

-- Query 5.1: Detailed LS/CMI Statistics (Fixed for SQLite)
SELECT 
    'Risk Assessment Statistics' as Category,
    COUNT(*) as Total_Assessments,
    ROUND(AVG(Risk_Score), 2) as Average_Score,
    MIN(Risk_Score) as Minimum_Score,
    MAX(Risk_Score) as Maximum_Score,
    ROUND(
        SQRT(
            AVG(Risk_Score * Risk_Score) - 
            AVG(Risk_Score) * AVG(Risk_Score)
        ), 
        2
    ) as Standard_Deviation
FROM RISK_ASSESSMENT
WHERE Risk_Score IS NOT NULL

UNION ALL

SELECT 
    'Participants with Assessments',
    COUNT(DISTINCT Participant_ID),
    NULL,
    NULL,
    NULL,
    NULL
FROM RISK_ASSESSMENT
WHERE Risk_Score IS NOT NULL;

-- Query 5.2: Conviction by Offense Type (Detailed Analysis)
SELECT 
    co.Offense_Name,
    co.Class,
    COUNT(*) as Total_Convictions,
    COUNT(DISTINCT pc.Participant_ID) as Unique_Participants,
    ROUND(AVG(CASE WHEN pc.Outcome = 'Convicted' THEN 1 ELSE 0 END) * 100, 2) as Conviction_Rate,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM PARTICIPANT_CHARGE WHERE Outcome = 'Convicted'), 2) as Percentage_of_All_Convictions
FROM PARTICIPANT_CHARGE pc
JOIN CHARGE_OFFENSE co ON pc.Offense_ID = co.Offense_ID
WHERE pc.Outcome = 'Convicted'
GROUP BY co.Offense_Name, co.Class
HAVING COUNT(*) >= 5  -- Only significant offenses
ORDER BY Total_Convictions DESC
LIMIT 15;

-- Query 5.3: Program Timeline Analysis
SELECT 
    'Program Duration (Days)' as Metric,
    ROUND(AVG(e.Length_Days), 1) as Average,
    MIN(e.Length_Days) as Minimum,
    MAX(e.Length_Days) as Maximum,
    COUNT(*) as Count
FROM MHC_ENROLLMENT e
WHERE e.Length_Days IS NOT NULL

UNION ALL

SELECT 
    'Time from First Charge to MHC Entry',
    ROUND(AVG(julianday(e.Start_Date) - julianday(first_charge.First_Charge_Date)), 1),
    MIN(julianday(e.Start_Date) - julianday(first_charge.First_Charge_Date)),
    MAX(julianday(e.Start_Date) - julianday(first_charge.First_Charge_Date)),
    COUNT(*)
FROM MHC_ENROLLMENT e
JOIN (
    SELECT 
        Participant_ID,
        MIN(Charge_Date) as First_Charge_Date
    FROM PARTICIPANT_CHARGE
    WHERE Charge_Date IS NOT NULL
    GROUP BY Participant_ID
) as first_charge ON e.Participant_ID = first_charge.Participant_ID
WHERE first_charge.First_Charge_Date IS NOT NULL;


-- Query 5.4: Treatment Episode Tracking
SELECT 
    te.Treatment_Type,
    COUNT(*) as Total_Episodes,
    COUNT(DISTINCT te.Participant_ID) as Unique_Participants,
    ROUND(AVG(
        CASE 
            WHEN te.Start_Date IS NOT NULL AND te.End_Date IS NOT NULL 
            THEN julianday(te.End_Date) - julianday(te.Start_Date)
            ELSE NULL 
        END
    ), 1) as Average_Duration_Days,
    ROUND(COUNT(DISTINCT te.Participant_ID) * 100.0 / 
          (SELECT COUNT(*) FROM PARTICIPANT), 2) as Participation_Rate
FROM TREATMENT_EPISODE te
WHERE te.Treatment_Type IS NOT NULL
GROUP BY te.Treatment_Type
ORDER BY Total_Episodes DESC;

-- Query 5.5: Court Compliance Tracking
SELECT 
    'Participants with Treatment Episodes' as Metric,
    COUNT(DISTINCT te.Participant_ID) as Value,
    ROUND(COUNT(DISTINCT te.Participant_ID) * 100.0 / 
          (SELECT COUNT(*) FROM MHC_ENROLLMENT), 2) as Percentage
FROM TREATMENT_EPISODE te

UNION ALL

SELECT 
    'Average Treatment Episodes per Participant',
    ROUND(AVG(Episode_Count), 2),
    NULL
FROM (
    SELECT Participant_ID, COUNT(*) as Episode_Count
    FROM TREATMENT_EPISODE
    GROUP BY Participant_ID
) as Episode_Counts

UNION ALL

SELECT 
    'Participants with Risk Assessments',
    COUNT(DISTINCT ra.Participant_ID),
    ROUND(COUNT(DISTINCT ra.Participant_ID) * 100.0 / 
          (SELECT COUNT(*) FROM MHC_ENROLLMENT), 2)
FROM RISK_ASSESSMENT ra;

-- Query 5.6: Recidivism by Demographic Characteristics
SELECT 
    p.Gender,
    COUNT(DISTINCT p.Participant_ID) as Total_Participants,
    COUNT(DISTINCT CASE 
        WHEN pc.Charge_Date > e.End_Date 
             AND e.End_Date IS NOT NULL
             AND julianday(pc.Charge_Date) - julianday(e.End_Date) <= 365
        THEN p.Participant_ID 
    END) as Recidivated_Within_1_Year,
    ROUND(COUNT(DISTINCT CASE 
        WHEN pc.Charge_Date > e.End_Date 
             AND e.End_Date IS NOT NULL
             AND julianday(pc.Charge_Date) - julianday(e.End_Date) <= 365
        THEN p.Participant_ID 
    END) * 100.0 / COUNT(DISTINCT p.Participant_ID), 2) as Recidivism_Rate
FROM PARTICIPANT p
JOIN MHC_ENROLLMENT e ON p.Participant_ID = e.Participant_ID
LEFT JOIN PARTICIPANT_CHARGE pc ON p.Participant_ID = pc.Participant_ID
WHERE p.Gender IS NOT NULL 
  AND e.End_Date IS NOT NULL
  AND e.End_Status IN ('Graduated', 'Terminated')
GROUP BY p.Gender

UNION ALL

SELECT 
    'TOTAL',
    COUNT(DISTINCT p.Participant_ID),
    COUNT(DISTINCT CASE 
        WHEN pc.Charge_Date > e.End_Date 
             AND e.End_Date IS NOT NULL
             AND julianday(pc.Charge_Date) - julianday(e.End_Date) <= 365
        THEN p.Participant_ID 
    END),
    ROUND(COUNT(DISTINCT CASE 
        WHEN pc.Charge_Date > e.End_Date 
             AND e.End_Date IS NOT NULL
             AND julianday(pc.Charge_Date) - julianday(e.End_Date) <= 365
        THEN p.Participant_ID 
    END) * 100.0 / COUNT(DISTINCT p.Participant_ID), 2)
FROM PARTICIPANT p
JOIN MHC_ENROLLMENT e ON p.Participant_ID = e.Participant_ID
LEFT JOIN PARTICIPANT_CHARGE pc ON p.Participant_ID = pc.Participant_ID
WHERE e.End_Date IS NOT NULL
  AND e.End_Status IN ('Graduated', 'Terminated');

-- Query 5.7: Geographic Equity Analysis (Simplified - using available data)
SELECT 
    'Demographic Analysis' as Category,
    'Gender Distribution' as Metric,
    COUNT(*) as Value,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM PARTICIPANT), 2) as Percentage
FROM PARTICIPANT
WHERE UPPER(Gender) LIKE 'M%'

UNION ALL

SELECT 
    'Demographic Analysis',
    'Race Distribution - White',
    COUNT(*),
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM PARTICIPANT WHERE Race_Ethnicity IS NOT NULL), 2)
FROM PARTICIPANT
WHERE Race_Ethnicity = 'White'

UNION ALL

SELECT 
    'Program Access',
    'Participants with Mental Health Diagnosis',
    COUNT(DISTINCT pd.Participant_ID),
    ROUND(COUNT(DISTINCT pd.Participant_ID) * 100.0 / (SELECT COUNT(*) FROM PARTICIPANT), 2)
FROM PARTICIPANT_DIAGNOSIS pd

UNION ALL

SELECT 
    'Program Access',
    'Participants with Treatment',
    COUNT(DISTINCT te.Participant_ID),
    ROUND(COUNT(DISTINCT te.Participant_ID) * 100.0 / (SELECT COUNT(*) FROM PARTICIPANT), 2)
FROM TREATMENT_EPISODE te;


-- Query 5.8: Diagnosis Combinations Analysis
SELECT 
    'Common Diagnosis Combinations' as Analysis_Type,
    CASE 
        WHEN Diagnosis_Description LIKE '%PTSD%' AND Diagnosis_Description LIKE '%BIPOLAR%' THEN 'PTSD + Bipolar'
        WHEN Diagnosis_Description LIKE '%PTSD%' AND Diagnosis_Description LIKE '%ANXIETY%' THEN 'PTSD + Anxiety'
        WHEN Diagnosis_Description LIKE '%PTSD%' AND Diagnosis_Description LIKE '%DEPRESS%' THEN 'PTSD + Depression'
        WHEN Diagnosis_Description LIKE '%BIPOLAR%' AND Diagnosis_Description LIKE '%ANXIETY%' THEN 'Bipolar + Anxiety'
        ELSE 'Other Combinations'
    END as Diagnosis_Combination,
    COUNT(*) as Participant_Count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM PARTICIPANT_DIAGNOSIS), 2) as Percentage
FROM PARTICIPANT_DIAGNOSIS
WHERE Diagnosis_Description IS NOT NULL
GROUP BY 
    CASE 
        WHEN Diagnosis_Description LIKE '%PTSD%' AND Diagnosis_Description LIKE '%BIPOLAR%' THEN 'PTSD + Bipolar'
        WHEN Diagnosis_Description LIKE '%PTSD%' AND Diagnosis_Description LIKE '%ANXIETY%' THEN 'PTSD + Anxiety'
        WHEN Diagnosis_Description LIKE '%PTSD%' AND Diagnosis_Description LIKE '%DEPRESS%' THEN 'PTSD + Depression'
        WHEN Diagnosis_Description LIKE '%BIPOLAR%' AND Diagnosis_Description LIKE '%ANXIETY%' THEN 'Bipolar + Anxiety'
        ELSE 'Other Combinations'
    END
ORDER BY Participant_Count DESC;

-- Query 5.9: Longitudinal Outcomes (Extended Follow-up)
SELECT 
    'Post-MHC Follow-up (All Exited Participants)' as Time_Period,
    COUNT(DISTINCT e.Participant_ID) as Total_Participants,
    COUNT(DISTINCT CASE 
        WHEN pc.Charge_Date > e.End_Date 
        THEN e.Participant_ID 
    END) as Participants_With_Any_Post_MHC_Charge,
    COUNT(DISTINCT CASE 
        WHEN pc.Outcome = 'Convicted' 
             AND pc.Charge_Date > e.End_Date 
        THEN e.Participant_ID 
    END) as Participants_With_Post_MHC_Conviction,
    ROUND(COUNT(DISTINCT CASE 
        WHEN pc.Charge_Date > e.End_Date 
        THEN e.Participant_ID 
    END) * 100.0 / COUNT(DISTINCT e.Participant_ID), 2) as Any_Charge_Rate,
    ROUND(COUNT(DISTINCT CASE 
        WHEN pc.Outcome = 'Convicted' 
             AND pc.Charge_Date > e.End_Date 
        THEN e.Participant_ID 
    END) * 100.0 / COUNT(DISTINCT e.Participant_ID), 2) as Conviction_Rate
FROM MHC_ENROLLMENT e
LEFT JOIN PARTICIPANT_CHARGE pc ON e.Participant_ID = pc.Participant_ID
WHERE e.End_Date IS NOT NULL
  AND e.End_Status IN ('Graduated', 'Terminated', 'Discharged')

UNION ALL

SELECT 
    'Graduates Only',
    COUNT(DISTINCT e.Participant_ID),
    COUNT(DISTINCT CASE 
        WHEN pc.Charge_Date > e.End_Date 
        THEN e.Participant_ID 
    END),
    COUNT(DISTINCT CASE 
        WHEN pc.Outcome = 'Convicted' 
             AND pc.Charge_Date > e.End_Date 
        THEN e.Participant_ID 
    END),
    ROUND(COUNT(DISTINCT CASE 
        WHEN pc.Charge_Date > e.End_Date 
        THEN e.Participant_ID 
    END) * 100.0 / COUNT(DISTINCT e.Participant_ID), 2),
    ROUND(COUNT(DISTINCT CASE 
        WHEN pc.Outcome = 'Convicted' 
             AND pc.Charge_Date > e.End_Date 
        THEN e.Participant_ID 
    END) * 100.0 / COUNT(DISTINCT e.Participant_ID), 2)
FROM MHC_ENROLLMENT e
LEFT JOIN PARTICIPANT_CHARGE pc ON e.Participant_ID = pc.Participant_ID
WHERE e.End_Date IS NOT NULL
  AND e.End_Status = 'Graduated';