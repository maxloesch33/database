-- =========================================================================
-- MHC_Schema_DDL.sql
-- Database Schema for the Mental Health Court Project
-- =========================================================================

-- 1. DIAGNOSIS_CODE (Lookup Table)
CREATE TABLE DIAGNOSIS_CODE (
    Code VARCHAR(50) PRIMARY KEY,
    Description VARCHAR(255) NOT NULL
);

-- 2. PARTICIPANT (Core Entity)
CREATE TABLE PARTICIPANT (
    Participant_ID VARCHAR(50) PRIMARY KEY,
    First_Name VARCHAR(100) NOT NULL,
    Last_Name VARCHAR(100) NOT NULL,
    Date_of_Birth DATE NOT NULL,
    Gender VARCHAR(10) NOT NULL,
    Race_Ethnicity VARCHAR(100)
);

-- 3. MHC_ENROLLMENT
CREATE TABLE MHC_ENROLLMENT (
    Participant_ID VARCHAR(50) NOT NULL,
    Start_Date DATE NOT NULL,
    End_Date DATE,
    End_Status VARCHAR(50) NOT NULL,
    Length_Days REAL,
    
    FOREIGN KEY (Participant_ID) REFERENCES PARTICIPANT(Participant_ID)
);

-- 4. CHARGE_OFFENSE
CREATE TABLE CHARGE_OFFENSE (
    Offense_ID INTEGER PRIMARY KEY,
    Offense_Name TEXT NOT NULL,
    Class VARCHAR(20)
);

-- 5. PARTICIPANT_CHARGE
CREATE TABLE PARTICIPANT_CHARGE (
    Participant_ID VARCHAR(50) NOT NULL,
    Offense_ID INTEGER NOT NULL,
    Charge_Date DATE NOT NULL,
    Status_at_Charge VARCHAR(50),
    Outcome VARCHAR(50),
    
    FOREIGN KEY (Participant_ID) REFERENCES PARTICIPANT(Participant_ID),
    FOREIGN KEY (Offense_ID) REFERENCES CHARGE_OFFENSE(Offense_ID)
);

-- 6. PARTICIPANT_DIAGNOSIS (Renamed from DIAGNOSIS)
CREATE TABLE PARTICIPANT_DIAGNOSIS (
    Participant_ID VARCHAR(50) NOT NULL,
    Diagnosis_Code VARCHAR(50),
    Diagnosis_Description VARCHAR(255),
    Assessment_Date DATE,
    
    FOREIGN KEY (Participant_ID) REFERENCES PARTICIPANT(Participant_ID),
    FOREIGN KEY (Diagnosis_Code) REFERENCES DIAGNOSIS_CODE(Code)
);

-- 7. RISK_ASSESSMENT
CREATE TABLE RISK_ASSESSMENT (
    Participant_ID VARCHAR(50) NOT NULL,
    Assessment_Date DATE,
    Risk_Score REAL,
    Risk_Category VARCHAR(50),
    
    FOREIGN KEY (Participant_ID) REFERENCES PARTICIPANT(Participant_ID)
);

-- 8. JAIL_DATA (Renamed from JAIL_DAYS)
CREATE TABLE JAIL_DATA (
    Participant_ID VARCHAR(50) NOT NULL,
    Start_Date DATE,
    End_Date DATE,
    Days_Incarcerated REAL,
    Cost REAL,
    
    FOREIGN KEY (Participant_ID) REFERENCES PARTICIPANT(Participant_ID)
);

-- 9. TREATMENT_EPISODE
CREATE TABLE TREATMENT_EPISODE (
    Participant_ID VARCHAR(50) NOT NULL,
    Treatment_Type VARCHAR(50),
    Start_Date DATE,
    End_Date DATE,
    Service_Type VARCHAR(100),
    Provider VARCHAR(100),
    Outcome VARCHAR(100),
    
    FOREIGN KEY (Participant_ID) REFERENCES PARTICIPANT(Participant_ID)
);

-- 10. PSYCHOSOCIAL_ASSESSMENT (Added for completeness)
CREATE TABLE PSYCHOSOCIAL_ASSESSMENT (
    Participant_ID VARCHAR(50) NOT NULL,
    Assessment_Date DATE,
    -- Additional columns would be added based on CSV structure
    
    FOREIGN KEY (Participant_ID) REFERENCES PARTICIPANT(Participant_ID)
);

-- Create indexes for better performance
CREATE INDEX idx_participant_charge_participant ON PARTICIPANT_CHARGE(Participant_ID);
CREATE INDEX idx_participant_charge_date ON PARTICIPANT_CHARGE(Charge_Date);
CREATE INDEX idx_mhc_enrollment_participant ON MHC_ENROLLMENT(Participant_ID);
CREATE INDEX idx_mhc_enrollment_dates ON MHC_ENROLLMENT(Start_Date, End_Date);
CREATE INDEX idx_participant_diagnosis_participant ON PARTICIPANT_DIAGNOSIS(Participant_ID);
CREATE INDEX idx_risk_assessment_participant ON RISK_ASSESSMENT(Participant_ID);
CREATE INDEX idx_jail_data_participant ON JAIL_DATA(Participant_ID);
CREATE INDEX idx_treatment_episode_participant ON TREATMENT_EPISODE(Participant_ID);