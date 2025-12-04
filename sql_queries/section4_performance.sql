-- ============================================
-- SECTION 4: Program Performance & Outcomes
-- ============================================

-- Query 4.1: Phase Progression Rates
-- Note: You'll need to adjust based on your actual phase tracking data
SELECT 
    'Phase 1 to 2' as Phase_Transition,
    COUNT(DISTINCT p.Participant_ID) as Attempted_Transition,
    COUNT(DISTINCT CASE WHEN e.End_Status = 'Graduated' THEN p.Participant_ID END) as Successful_Graduation,
    ROUND(COUNT(DISTINCT CASE WHEN e.End_Status = 'Graduated' THEN p.Participant_ID END) * 100.0 / 
          COUNT(DISTINCT p.Participant_ID), 2) as Success_Rate
FROM PARTICIPANT p
JOIN MHC_ENROLLMENT e ON p.Participant_ID = e.Participant_ID
WHERE e.End_Status IS NOT NULL

UNION ALL

SELECT 
    'Overall Program Completion',
    COUNT(DISTINCT p.Participant_ID),
    COUNT(DISTINCT CASE WHEN e.End_Status = 'Graduated' THEN p.Participant_ID END),
    ROUND(COUNT(DISTINCT CASE WHEN e.End_Status = 'Graduated' THEN p.Participant_ID END) * 100.0 / 
          COUNT(DISTINCT p.Participant_ID), 2)
FROM PARTICIPANT p
JOIN MHC_ENROLLMENT e ON p.Participant_ID = e.Participant_ID
WHERE e.End_Status IS NOT NULL;

-- Query 4.2: Exit Status Distribution
SELECT 
    e.End_Status,
    COUNT(*) as Participant_Count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM MHC_ENROLLMENT WHERE End_Status IS NOT NULL), 2) as Percentage,
    ROUND(AVG(e.Length_Days), 1) as Average_Length_Days
FROM MHC_ENROLLMENT e
WHERE e.End_Status IS NOT NULL
GROUP BY e.End_Status
ORDER BY Participant_Count DESC;

-- Query 4.3: Graduation Rates by Fiscal Year
SELECT 
    CASE 
        WHEN strftime('%Y', e.Start_Date) = '2023' THEN 'FY23'
        WHEN strftime('%Y', e.Start_Date) = '2024' THEN 'FY24'
        ELSE 'Other Years'
    END as Fiscal_Year,
    COUNT(*) as Total_Participants,
    SUM(CASE WHEN e.End_Status = 'Graduated' THEN 1 ELSE 0 END) as Graduated,
    SUM(CASE WHEN e.End_Status = 'Terminated' THEN 1 ELSE 0 END) as Terminated,
    ROUND(SUM(CASE WHEN e.End_Status = 'Graduated' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as Graduation_Rate,
    ROUND(SUM(CASE WHEN e.End_Status = 'Terminated' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as Termination_Rate
FROM MHC_ENROLLMENT e
WHERE e.End_Status IS NOT NULL
  AND strftime('%Y', e.Start_Date) IN ('2023', '2024')
GROUP BY 
    CASE 
        WHEN strftime('%Y', e.Start_Date) = '2023' THEN 'FY23'
        WHEN strftime('%Y', e.Start_Date) = '2024' THEN 'FY24'
        ELSE 'Other Years'
    END
ORDER BY Fiscal_Year;

-- Query 4.4: Conviction Reduction Analysis (89-91% reduction during MHC)
SELECT 
    'Before MHC (12 months prior)' as Period,
    COUNT(*) as Total_Convictions,
    COUNT(DISTINCT pc.Participant_ID) as Participants_With_Convictions,
    ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT pc.Participant_ID), 2) as Avg_Convictions_Per_Participant
FROM PARTICIPANT_CHARGE pc
JOIN MHC_ENROLLMENT e ON pc.Participant_ID = e.Participant_ID
WHERE pc.Outcome = 'Convicted' 
  AND pc.Charge_Date < e.Start_Date
  AND julianday(e.Start_Date) - julianday(pc.Charge_Date) <= 365  -- Within 1 year before

UNION ALL

SELECT 
    'During MHC Participation',
    COUNT(*) as Total_Convictions,
    COUNT(DISTINCT pc.Participant_ID) as Participants_With_Convictions,
    ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT pc.Participant_ID), 2) as Avg_Convictions_Per_Participant
FROM PARTICIPANT_CHARGE pc
JOIN MHC_ENROLLMENT e ON pc.Participant_ID = e.Participant_ID
WHERE pc.Outcome = 'Convicted' 
  AND pc.Charge_Date >= e.Start_Date 
  AND (pc.Charge_Date <= e.End_Date OR e.End_Date IS NULL);

-- Query 4.5: Felony Reduction Rates (88-96% reduction)
SELECT 
    'Felony Convictions Before MHC' as Category,
    COUNT(*) as Conviction_Count,
    COUNT(DISTINCT pc.Participant_ID) as Participants
FROM PARTICIPANT_CHARGE pc
JOIN MHC_ENROLLMENT e ON pc.Participant_ID = e.Participant_ID
JOIN CHARGE_OFFENSE co ON pc.Offense_ID = co.Offense_ID
WHERE pc.Outcome = 'Convicted' 
  AND co.Class = 'F'  -- Felony class
  AND pc.Charge_Date < e.Start_Date

UNION ALL

SELECT 
    'Felony Convictions During MHC',
    COUNT(*) as Conviction_Count,
    COUNT(DISTINCT pc.Participant_ID) as Participants
FROM PARTICIPANT_CHARGE pc
JOIN MHC_ENROLLMENT e ON pc.Participant_ID = e.Participant_ID
JOIN CHARGE_OFFENSE co ON pc.Offense_ID = co.Offense_ID
WHERE pc.Outcome = 'Convicted' 
  AND co.Class = 'F'  -- Felony class
  AND pc.Charge_Date >= e.Start_Date 
  AND (pc.Charge_Date <= e.End_Date OR e.End_Date IS NULL);

-- Query 4.6: Law-Abiding Participants (71-78% with no charges during MHC)
SELECT 
    'Participants with NO Charges During MHC' as Category,
    COUNT(DISTINCT e.Participant_ID) as Participant_Count,
    COUNT(DISTINCT e.Participant_ID) * 100.0 / (SELECT COUNT(*) FROM MHC_ENROLLMENT) as Percentage
FROM MHC_ENROLLMENT e
WHERE NOT EXISTS (
    SELECT 1 
    FROM PARTICIPANT_CHARGE pc 
    WHERE pc.Participant_ID = e.Participant_ID 
      AND pc.Charge_Date >= e.Start_Date 
      AND (pc.Charge_Date <= e.End_Date OR e.End_Date IS NULL)
)

UNION ALL

SELECT 
    'Participants with Charges During MHC',
    COUNT(DISTINCT e.Participant_ID),
    COUNT(DISTINCT e.Participant_ID) * 100.0 / (SELECT COUNT(*) FROM MHC_ENROLLMENT)
FROM MHC_ENROLLMENT e
WHERE EXISTS (
    SELECT 1 
    FROM PARTICIPANT_CHARGE pc 
    WHERE pc.Participant_ID = e.Participant_ID 
      AND pc.Charge_Date >= e.Start_Date 
      AND (pc.Charge_Date <= e.End_Date OR e.End_Date IS NULL)
);



-- Query 4.7: Jail Days Analysis (Simplified)
SELECT 
    'Total Jail Days During MHC' as Metric,
    SUM(jd.Days_Incarcerated) as Value,
    COUNT(DISTINCT jd.Participant_ID) as Participants_Affected
FROM JAIL_DATA jd
WHERE jd.Days_Incarcerated IS NOT NULL

UNION ALL

SELECT 
    'Average Jail Days Per Incarcerated Participant',
    ROUND(AVG(jd.Days_Incarcerated), 1),
    NULL
FROM JAIL_DATA jd
WHERE jd.Days_Incarcerated IS NOT NULL

UNION ALL

SELECT 
    'Percentage of Participants with Jail Time During MHC',
    ROUND(COUNT(DISTINCT jd.Participant_ID) * 100.0 / 
          (SELECT COUNT(*) FROM MHC_ENROLLMENT), 2),
    NULL
FROM JAIL_DATA jd
WHERE jd.Days_Incarcerated IS NOT NULL;

-- Query 4.8: Estimated Cost Savings ($378,858 during, $439,020 after)
-- Using $271/day jail cost from your project document
SELECT 
    'Estimated Jail Cost Savings During MHC' as Metric,
    ROUND(SUM(jd.Days_Incarcerated) * 271.0, 2) as Value
FROM JAIL_DATA jd
WHERE jd.Days_Incarcerated IS NOT NULL

UNION ALL

SELECT 
    'Potential Cost Without MHC (Based on Before Rates)',
    ROUND(
        (SELECT COUNT(*) FROM MHC_ENROLLMENT) *  -- All participants
        (SELECT AVG(e.Length_Days) FROM MHC_ENROLLMENT e) / 365.0 *  -- Average program years
        (SELECT AVG(jd2.Days_Incarcerated) * 271.0 FROM JAIL_DATA jd2) * 1.5,  -- Estimated before rate (1.5x during)
        2
    )

UNION ALL

SELECT 
    'Estimated Net Cost Savings',
    ROUND(
        (SELECT COUNT(*) FROM MHC_ENROLLMENT) * 
        (SELECT AVG(e.Length_Days) FROM MHC_ENROLLMENT e) / 365.0 * 
        (SELECT AVG(jd2.Days_Incarcerated) * 271.0 FROM JAIL_DATA jd2) * 1.5 -
        (SELECT SUM(jd.Days_Incarcerated) * 271.0 FROM JAIL_DATA jd WHERE jd.Days_Incarcerated IS NOT NULL),
        2
    );

-- Query 4.9: Post-MHC Outcomes (Graduates vs Terminated)
SELECT 
    CASE 
        WHEN e.End_Status = 'Graduated' THEN 'Graduates'
        WHEN e.End_Status = 'Terminated' THEN 'Terminated Participants'
        ELSE 'Other'
    END as Group_Type,
    COUNT(DISTINCT e.Participant_ID) as Participant_Count,
    COUNT(DISTINCT CASE 
        WHEN pc.Charge_Date > e.End_Date 
             AND julianday(pc.Charge_Date) - julianday(e.End_Date) <= 365
        THEN pc.Participant_ID 
    END) as Participants_With_Post_MHC_Charges,
    COUNT(DISTINCT CASE 
        WHEN pc.Outcome = 'Convicted' 
             AND pc.Charge_Date > e.End_Date 
             AND julianday(pc.Charge_Date) - julianday(e.End_Date) <= 365
        THEN pc.Participant_ID 
    END) as Participants_With_Post_MHC_Convictions,
    ROUND(COUNT(DISTINCT CASE 
        WHEN pc.Charge_Date > e.End_Date 
             AND julianday(pc.Charge_Date) - julianday(e.End_Date) <= 365
        THEN pc.Participant_ID 
    END) * 100.0 / COUNT(DISTINCT e.Participant_ID), 2) as Percentage_With_Post_MHC_Charges
FROM MHC_ENROLLMENT e
LEFT JOIN PARTICIPANT_CHARGE pc ON e.Participant_ID = pc.Participant_ID
WHERE e.End_Status IN ('Graduated', 'Terminated')
  AND e.End_Date IS NOT NULL
GROUP BY 
    CASE 
        WHEN e.End_Status = 'Graduated' THEN 'Graduates'
        WHEN e.End_Status = 'Terminated' THEN 'Terminated Participants'
        ELSE 'Other'
    END;