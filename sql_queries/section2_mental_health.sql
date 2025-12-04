-- ============================================
-- SECTION 2: Mental Health Characteristics
-- ============================================

-- Query 2.1: Mental Health Diagnosis Distribution (Updated for your data)
SELECT 
    pd.Diagnosis_Description as Diagnosis,
    COUNT(DISTINCT pd.Participant_ID) as Participant_Count,
    ROUND(COUNT(DISTINCT pd.Participant_ID) * 100.0 / 
          (SELECT COUNT(DISTINCT Participant_ID) FROM PARTICIPANT_DIAGNOSIS), 2) as Percentage
FROM PARTICIPANT_DIAGNOSIS pd
WHERE pd.Diagnosis_Description IS NOT NULL
GROUP BY pd.Diagnosis_Description
ORDER BY Participant_Count DESC;

-- Query 2.2: PTSD Prevalence Analysis (Based on text in diagnosis)
SELECT 
    'PTSD Cases' as Category,
    COUNT(DISTINCT CASE 
        WHEN UPPER(pd.Diagnosis_Description) LIKE '%PTSD%' 
             OR UPPER(pd.Diagnosis_Description) LIKE '%POST-TRAUMATIC%'
             OR UPPER(pd.Diagnosis_Description) LIKE '%TRAUMA%'
        THEN pd.Participant_ID 
    END) as Count,
    COUNT(DISTINCT pd.Participant_ID) as Total_Assessed,
    ROUND(COUNT(DISTINCT CASE 
        WHEN UPPER(pd.Diagnosis_Description) LIKE '%PTSD%' 
             OR UPPER(pd.Diagnosis_Description) LIKE '%POST-TRAUMATIC%'
             OR UPPER(pd.Diagnosis_Description) LIKE '%TRAUMA%'
        THEN pd.Participant_ID 
    END) * 100.0 / COUNT(DISTINCT pd.Participant_ID), 2) as Percentage
FROM PARTICIPANT_DIAGNOSIS pd

UNION ALL

SELECT 
    'Non-PTSD Cases',
    COUNT(DISTINCT CASE 
        WHEN UPPER(pd.Diagnosis_Description) NOT LIKE '%PTSD%' 
             AND UPPER(pd.Diagnosis_Description) NOT LIKE '%POST-TRAUMATIC%'
             AND UPPER(pd.Diagnosis_Description) NOT LIKE '%TRAUMA%'
        THEN pd.Participant_ID 
    END),
    COUNT(DISTINCT pd.Participant_ID),
    ROUND(COUNT(DISTINCT CASE 
        WHEN UPPER(pd.Diagnosis_Description) NOT LIKE '%PTSD%' 
             AND UPPER(pd.Diagnosis_Description) NOT LIKE '%POST-TRAUMATIC%'
             AND UPPER(pd.Diagnosis_Description) NOT LIKE '%TRAUMA%'
        THEN pd.Participant_ID 
    END) * 100.0 / COUNT(DISTINCT pd.Participant_ID), 2)
FROM PARTICIPANT_DIAGNOSIS pd;

-- Query 2.3: Bipolar Disorder Analysis (Based on text in diagnosis)
SELECT 
    'Bipolar Disorder' as Diagnosis,
    COUNT(DISTINCT CASE 
        WHEN UPPER(pd.Diagnosis_Description) LIKE '%BIPOLAR%' 
             OR UPPER(pd.Diagnosis_Description) LIKE '%MANIC%'
        THEN pd.Participant_ID 
    END) as Participant_Count,
    COUNT(DISTINCT pd.Participant_ID) as Total_Assessed,
    ROUND(COUNT(DISTINCT CASE 
        WHEN UPPER(pd.Diagnosis_Description) LIKE '%BIPOLAR%' 
             OR UPPER(pd.Diagnosis_Description) LIKE '%MANIC%'
        THEN pd.Participant_ID 
    END) * 100.0 / COUNT(DISTINCT pd.Participant_ID), 2) as Percentage
FROM PARTICIPANT_DIAGNOSIS pd;

-- Query 2.4: Anxiety Disorder Analysis (Based on text in diagnosis)
SELECT 
    'Anxiety Disorders' as Diagnosis,
    COUNT(DISTINCT CASE 
        WHEN UPPER(pd.Diagnosis_Description) LIKE '%ANXIETY%' 
             OR UPPER(pd.Diagnosis_Description) LIKE '%GAD%'
             OR UPPER(pd.Diagnosis_Description) LIKE '%PANIC%'
        THEN pd.Participant_ID 
    END) as Participant_Count,
    COUNT(DISTINCT pd.Participant_ID) as Total_Assessed,
    ROUND(COUNT(DISTINCT CASE 
        WHEN UPPER(pd.Diagnosis_Description) LIKE '%ANXIETY%' 
             OR UPPER(pd.Diagnosis_Description) LIKE '%GAD%'
             OR UPPER(pd.Diagnosis_Description) LIKE '%PANIC%'
        THEN pd.Participant_ID 
    END) * 100.0 / COUNT(DISTINCT pd.Participant_ID), 2) as Percentage
FROM PARTICIPANT_DIAGNOSIS pd;

-- Query 2.5: Co-occurring Disorders Analysis (Multiple Diagnoses)
-- Note: Your data shows each participant has ONE row with multiple diagnoses in text
-- We need to count the number of conditions mentioned
SELECT 
    CASE 
        WHEN (LENGTH(pd.Diagnosis_Description) - LENGTH(REPLACE(pd.Diagnosis_Description, ',', '')) + 1) >= 3 THEN '3+ Diagnoses'
        WHEN (LENGTH(pd.Diagnosis_Description) - LENGTH(REPLACE(pd.Diagnosis_Description, ',', '')) + 1) = 2 THEN '2 Diagnoses'
        ELSE '1 Diagnosis'
    END as Diagnosis_Complexity,
    COUNT(*) as Participant_Count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM PARTICIPANT_DIAGNOSIS), 2) as Percentage
FROM PARTICIPANT_DIAGNOSIS pd
WHERE pd.Diagnosis_Description IS NOT NULL
GROUP BY 
    CASE 
        WHEN (LENGTH(pd.Diagnosis_Description) - LENGTH(REPLACE(pd.Diagnosis_Description, ',', '')) + 1) >= 3 THEN '3+ Diagnoses'
        WHEN (LENGTH(pd.Diagnosis_Description) - LENGTH(REPLACE(pd.Diagnosis_Description, ',', '')) + 1) = 2 THEN '2 Diagnoses'
        ELSE '1 Diagnosis'
    END
ORDER BY Participant_Count DESC;

-- Query 2.6: Diagnosis Success Rates by Mental Health Condition
-- We'll analyze graduation rates by presence of specific conditions
SELECT 
    'PTSD Present' as Condition,
    COUNT(DISTINCT p.Participant_ID) as Total_With_Condition,
    SUM(CASE WHEN e.End_Status = 'Graduated' THEN 1 ELSE 0 END) as Graduated,
    ROUND(SUM(CASE WHEN e.End_Status = 'Graduated' THEN 1 ELSE 0 END) * 100.0 / 
          COUNT(DISTINCT p.Participant_ID), 2) as Graduation_Rate
FROM PARTICIPANT p
JOIN MHC_ENROLLMENT e ON p.Participant_ID = e.Participant_ID
JOIN PARTICIPANT_DIAGNOSIS pd ON p.Participant_ID = pd.Participant_ID
WHERE UPPER(pd.Diagnosis_Description) LIKE '%PTSD%'

UNION ALL

SELECT 
    'Bipolar Present',
    COUNT(DISTINCT p.Participant_ID),
    SUM(CASE WHEN e.End_Status = 'Graduated' THEN 1 ELSE 0 END),
    ROUND(SUM(CASE WHEN e.End_Status = 'Graduated' THEN 1 ELSE 0 END) * 100.0 / 
          COUNT(DISTINCT p.Participant_ID), 2)
FROM PARTICIPANT p
JOIN MHC_ENROLLMENT e ON p.Participant_ID = e.Participant_ID
JOIN PARTICIPANT_DIAGNOSIS pd ON p.Participant_ID = pd.Participant_ID
WHERE UPPER(pd.Diagnosis_Description) LIKE '%BIPOLAR%'

UNION ALL

SELECT 
    'Any MH Diagnosis' as Condition,
    COUNT(DISTINCT p.Participant_ID) as Total_With_Condition,
    SUM(CASE WHEN e.End_Status = 'Graduated' THEN 1 ELSE 0 END) as Graduated,
    ROUND(SUM(CASE WHEN e.End_Status = 'Graduated' THEN 1 ELSE 0 END) * 100.0 / 
          COUNT(DISTINCT p.Participant_ID), 2) as Graduation_Rate
FROM PARTICIPANT p
JOIN MHC_ENROLLMENT e ON p.Participant_ID = e.Participant_ID
WHERE EXISTS (SELECT 1 FROM PARTICIPANT_DIAGNOSIS pd WHERE pd.Participant_ID = p.Participant_ID);


-- Query 2.7: Treatment Engagement Rates Analysis
SELECT 
    'Mental Health Treatment' as Treatment_Type,
    COUNT(DISTINCT te.Participant_ID) as Participants_Treated,
    (SELECT COUNT(DISTINCT Participant_ID) FROM PARTICIPANT_DIAGNOSIS) as Total_Diagnosed,
    ROUND(COUNT(DISTINCT te.Participant_ID) * 100.0 / 
          (SELECT COUNT(DISTINCT Participant_ID) FROM PARTICIPANT_DIAGNOSIS), 2) as Engagement_Rate
FROM TREATMENT_EPISODE te
WHERE te.Treatment_Type = 'Mental Health'

UNION ALL

SELECT 
    'Chemical Dependency Treatment',
    COUNT(DISTINCT te.Participant_ID),
    (SELECT COUNT(DISTINCT Participant_ID) FROM PARTICIPANT_DIAGNOSIS),
    ROUND(COUNT(DISTINCT te.Participant_ID) * 100.0 / 
          (SELECT COUNT(DISTINCT Participant_ID) FROM PARTICIPANT_DIAGNOSIS), 2)
FROM TREATMENT_EPISODE te
WHERE te.Treatment_Type = 'Chemical Dependency';

-- Query 2.8: Diagnosis Trends Over Time (PTSD Increase Analysis)
SELECT 
    CASE 
        WHEN strftime('%Y', e.Start_Date) BETWEEN '2019' AND '2020' THEN '2019-2020'
        WHEN strftime('%Y', e.Start_Date) = '2021' THEN '2021'
        WHEN strftime('%Y', e.Start_Date) = '2022' THEN '2022'
        WHEN strftime('%Y', e.Start_Date) = '2023' THEN '2023'
        WHEN strftime('%Y', e.Start_Date) = '2024' THEN '2024'
        ELSE 'Other'
    END as Enrollment_Year,
    COUNT(DISTINCT p.Participant_ID) as Total_Participants,
    COUNT(DISTINCT CASE 
        WHEN UPPER(pd.Diagnosis_Description) LIKE '%PTSD%' 
             OR UPPER(pd.Diagnosis_Description) LIKE '%POST-TRAUMATIC%'
        THEN p.Participant_ID 
    END) as PTSD_Cases,
    ROUND(COUNT(DISTINCT CASE 
        WHEN UPPER(pd.Diagnosis_Description) LIKE '%PTSD%' 
             OR UPPER(pd.Diagnosis_Description) LIKE '%POST-TRAUMATIC%'
        THEN p.Participant_ID 
    END) * 100.0 / COUNT(DISTINCT p.Participant_ID), 2) as PTSD_Percentage
FROM PARTICIPANT p
JOIN MHC_ENROLLMENT e ON p.Participant_ID = e.Participant_ID
LEFT JOIN PARTICIPANT_DIAGNOSIS pd ON p.Participant_ID = pd.Participant_ID
GROUP BY 
    CASE 
        WHEN strftime('%Y', e.Start_Date) BETWEEN '2019' AND '2020' THEN '2019-2020'
        WHEN strftime('%Y', e.Start_Date) = '2021' THEN '2021'
        WHEN strftime('%Y', e.Start_Date) = '2022' THEN '2022'
        WHEN strftime('%Y', e.Start_Date) = '2023' THEN '2023'
        WHEN strftime('%Y', e.Start_Date) = '2024' THEN '2024'
        ELSE 'Other'
    END
ORDER BY MIN(e.Start_Date);