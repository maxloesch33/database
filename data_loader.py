import pandas as pd
import sqlite3
import os
from datetime import datetime

# --- Helper Functions ---

def create_participant_id(name):
    """Generates a standardized, unique ID from a participant's name."""
    if pd.isna(name) or not isinstance(name, str):
        return None
    cleaned_name = str(name).lower().replace(' ', '').replace(',', '-').replace('.', '').replace('/', '').strip()
    return cleaned_name

def find_column_by_keywords(df, keywords, exact_match=False):
    """Find a column in dataframe that contains any of the keywords."""
    for col in df.columns:
        col_upper = col.upper()
        for keyword in keywords:
            if exact_match:
                if col_upper == keyword.upper():
                    return col
            else:
                if keyword.upper() in col_upper:
                    return col
    return None

def load_data():
    """Main function to orchestrate the data loading process."""
    DB_NAME = 'MHC_Project.db'
    SCHEMA_FILE = 'MHC_Schema_DDL.sql'
    
    conn = sqlite3.connect(DB_NAME)
    print(f"Connected to database: {DB_NAME}")
    
    try:
        create_schema(conn, SCHEMA_FILE)
        load_diagnosis_codes(conn)
        load_participants_and_enrollment(conn)
        load_criminal_charges(conn)
        load_mental_health_data(conn)
        load_risk_assessments(conn)
        load_jail_data(conn)
        load_treatment_episodes(conn)
        load_psychosocial_assessments(conn)

        conn.commit()
        print("\nData loading complete.")

    except Exception as e:
        print(f"\nAn error occurred during data loading: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()


# ----------------------------------------------------------------------
# --- Database Initialization (Step 0) ---
# ----------------------------------------------------------------------

def create_schema(conn, schema_file):
    print(f"[0] Creating schema from {schema_file}...")
    try:
        with open(schema_file, 'r') as f:
            sql_script = f.read()
        conn.executescript(sql_script)
        print("[0] Schema created successfully.")
    except FileNotFoundError:
        print(f"Error: Schema DDL file '{schema_file}' not found.")
    except Exception as e:
        print(f"Note creating schema: {e}")


# ----------------------------------------------------------------------
# --- Data Loading Functions ---
# ----------------------------------------------------------------------

def load_diagnosis_codes(conn):
    """Loads and cleans the dual-column diagnosis code list."""
    print("[1] Loading DIAGNOSIS_CODE data...")
    try:
        df_codes = pd.read_csv("MHC_Diagnosis_Codes.csv", header=None)
    except FileNotFoundError:
        print("MHC_Diagnosis_Codes.csv not found.")
        return

    df_data = df_codes.iloc[1:] 
    
    df_part1 = df_data.loc[:, [0, 1]].copy()
    df_part1.columns = ['Code', 'Description']
    df_part1 = df_part1.dropna(subset=['Code'])
    
    df_part2 = df_data.loc[:, [4, 5]].copy()
    df_part2.columns = ['Code', 'Description']
    df_part2 = df_part2.dropna(subset=['Code'])
    
    df_final = pd.concat([df_part1, df_part2], ignore_index=True)
    
    df_final['Code'] = df_final['Code'].astype(str).str.strip()
    df_final['Description'] = df_final['Description'].astype(str).str.strip()

    df_final = df_final.drop_duplicates(subset=['Code']).set_index('Code')
    
    df_final.to_sql('DIAGNOSIS_CODE', conn, if_exists='replace', index=True, index_label='Code')
    
    print(f"Successfully loaded {len(df_final)} unique diagnosis codes.")


def load_participants_and_enrollment(conn):
    """Loads Participant Roster and Demographics to populate PARTICIPANT and MHC_ENROLLMENT."""
    print("[2] Loading PARTICIPANT and MHC_ENROLLMENT data...")
    try:
        df_roster = pd.read_csv("MHC_Participant_Roster.csv", header=0, skipinitialspace=True)
        df_roster.columns = df_roster.columns.str.strip()
        
        print("--- DEBUG: ACTUAL MHC ROSTER COLUMNS ---")
        print(df_roster.columns.tolist())
        print("---------------------------------------")
        
        df_demo = pd.read_csv("MHC_Demographics.csv", header=0, skipinitialspace=True)
        df_demo.columns = df_demo.columns.str.strip()
    except FileNotFoundError as e:
        print(f"Error: One of the required CSVs not found: {e}.")
        return

    REQUIRED_COL_NAME = 'Participant Name'
    
    if REQUIRED_COL_NAME not in df_roster.columns:
        print(f"FATAL ERROR: The required column '{REQUIRED_COL_NAME}' was not found in the Roster file.")
        raise KeyError(REQUIRED_COL_NAME)
        
    try:
        df_roster['Participant_ID'] = df_roster[REQUIRED_COL_NAME].apply(create_participant_id)
        df_demo_data = df_demo.copy()
        df_demo_data['Participant_ID'] = df_demo_data[REQUIRED_COL_NAME].apply(create_participant_id)

    except KeyError as e:
        print(f"FATAL ERROR: A required column was not found. Details: {e}")
        raise 
        
    df_participants = df_roster[['Participant_ID', REQUIRED_COL_NAME]].drop_duplicates(subset=['Participant_ID']).copy()
    
    demo_cols = ['Participant_ID', 'DOB', 'Gender', 'Race: White', 'Race: Black', 'Race: Native American', 'Race: Asian', 'Race: Other']
    df_participants = pd.merge(
        df_participants, 
        df_demo_data[demo_cols].drop_duplicates(subset=['Participant_ID']), 
        on='Participant_ID', 
        how='left'
    )
    
    df_participants = df_participants.rename(columns={'DOB': 'Date_of_Birth'})
    name_parts = df_participants[REQUIRED_COL_NAME].astype(str).str.split(', ', expand=True)
    df_participants['Last_Name'] = name_parts[0].str.strip()
    df_participants['First_Name'] = name_parts[1].str.strip()
    df_participants['Date_of_Birth'] = pd.to_datetime(df_participants['Date_of_Birth'], errors='coerce', dayfirst=False).dt.strftime('%Y-%m-%d')
    
    def determine_race(row):
        races = [col.replace('Race: ', '') for col in ['Race: White', 'Race: Black', 'Race: Native American', 'Race: Asian', 'Race: Other'] if row.get(col) == 1.0]
        if len(races) == 1:
            return races[0]
        elif len(races) > 1:
            return "Multi-Racial"
        else:
            return None 

    df_participants['Race_Ethnicity'] = df_participants.apply(determine_race, axis=1)
    
    participants_to_insert = df_participants[['Participant_ID', 'First_Name', 'Last_Name', 'Date_of_Birth', 'Gender', 'Race_Ethnicity']].copy()
    participants_to_insert = participants_to_insert.dropna(subset=['Participant_ID']).drop_duplicates(subset=['Participant_ID'])
    participants_to_insert.to_sql('PARTICIPANT', conn, if_exists='replace', index=False) 
    
    print(f"Successfully loaded {len(participants_to_insert)} unique participants.")

    enrollment_cols = ['Participant_ID', 'Date Started MHC', 'Date Ended MHC', 'Length of MHC', 'End Status']
    
    df_enrollment = df_roster[enrollment_cols].copy()
    
    df_enrollment['Start_Date'] = pd.to_datetime(df_enrollment['Date Started MHC'], errors='coerce', dayfirst=False)
    df_enrollment['End_Date'] = pd.to_datetime(df_enrollment['Date Ended MHC'], errors='coerce', dayfirst=False)
    
    df_enrollment['Start_Date'] = df_enrollment['Start_Date'].dt.strftime('%Y-%m-%d')
    df_enrollment['End_Date'] = df_enrollment['End_Date'].dt.strftime('%Y-%m-%d')
    
    df_enrollment.rename(columns={
        'Length of MHC': 'Length_Days',
        'End Status': 'End_Status' 
    }, inplace=True)
    
    df_enrollment = df_enrollment.dropna(subset=['Participant_ID', 'Start_Date'])
    
    final_enrollment_cols = ['Participant_ID', 'Start_Date', 'End_Date', 'End_Status', 'Length_Days']
    df_enrollment_final = df_enrollment[final_enrollment_cols].copy()
    
    df_enrollment_final.to_sql(
        'MHC_ENROLLMENT', 
        conn, 
        if_exists='replace',
        index=False
    )
    
    print(f"Successfully loaded {len(df_enrollment_final)} MHC enrollment records.")


def load_criminal_charges(conn):
    """Loads and normalizes the criminal charge data into CHARGE_OFFENSE and PARTICIPANT_CHARGE tables."""
    print("[3] Loading CRIMINAL CHARGE data...")
    try:
        df_charges = pd.read_csv("MHC_Criminal_History_Data.csv", header=0, skipinitialspace=True)
        df_charges.columns = df_charges.columns.str.strip()
        
        print("--- DEBUG: CRIMINAL HISTORY DATA COLUMNS ---")
        print(df_charges.columns.tolist())
        print("--------------------------------------------")
        
    except FileNotFoundError:
        print("MHC_Criminal_History_Data.csv not found. Skipping criminal charge load.")
        return

    charge_date_col = None
    for col in df_charges.columns:
        if col.upper() == 'CHARGE DATE':
            charge_date_col = col
            break
    
    if charge_date_col is None:
        for col in df_charges.columns:
            if 'CHARGE' in col.upper() and 'DATE' in col.upper():
                if 'MHC' not in col.upper():
                    charge_date_col = col
                    break
    
    if charge_date_col is None:
        print("ERROR: Could not find charge date column in criminal history data.")
        print("Available columns:", df_charges.columns.tolist())
        return
    
    print(f"Using '{charge_date_col}' as charge date column")
    
    df_charges_data = df_charges[df_charges[charge_date_col].notna()].copy()
    
    first_name_col = None
    last_name_col = None
    
    for col in df_charges.columns:
        if col.upper() == 'FIRST NAME':
            first_name_col = col
        elif col.upper() == 'LAST NAME':
            last_name_col = col
    
    if first_name_col is None:
        first_name_col = find_column_by_keywords(df_charges, ['FIRST'])
    if last_name_col is None:
        last_name_col = find_column_by_keywords(df_charges, ['LAST'])
    
    if first_name_col is None or last_name_col is None:
        print(f"ERROR: Could not find name columns. First: {first_name_col}, Last: {last_name_col}")
        print("Available columns:", df_charges.columns.tolist())
        return
    
    print(f"Using '{first_name_col}' and '{last_name_col}' for participant ID generation")
    
    df_charges_data['Participant_ID'] = (
        df_charges_data[last_name_col].astype(str).str.strip() + 
        ', ' + 
        df_charges_data[first_name_col].astype(str).str.strip()
    ).apply(create_participant_id)

    offense_col = find_column_by_keywords(df_charges, ['OFFENSE'], exact_match=True)
    class_col = find_column_by_keywords(df_charges, ['CLASS'], exact_match=True)
    
    if offense_col is None:
        offense_col = find_column_by_keywords(df_charges, ['OFFENSE'])
    if class_col is None:
        class_col = find_column_by_keywords(df_charges, ['CLASS'])
    
    if offense_col is None or class_col is None:
        print(f"ERROR: Could not find offense or class columns. Offense: {offense_col}, Class: {class_col}")
        print("Available columns:", df_charges.columns.tolist())
        return
    
    print(f"Using '{offense_col}' and '{class_col}' for offense normalization")
    
    df_offenses = df_charges_data[[offense_col, class_col]].copy().drop_duplicates()
    df_offenses['Offense_Name'] = df_offenses[offense_col].str.strip()
    df_offenses['Class'] = df_offenses[class_col].str.strip().str.upper()
    
    df_offenses['Offense_ID'] = range(1, len(df_offenses) + 1)
    
    df_offenses_to_insert = df_offenses[['Offense_ID', 'Offense_Name', 'Class']]
    df_offenses_to_insert.to_sql('CHARGE_OFFENSE', conn, if_exists='replace', index=False)
    
    print(f"Successfully loaded {len(df_offenses_to_insert)} unique charge offenses.")

    df_merged = pd.merge(
        df_charges_data, 
        df_offenses, 
        on=[offense_col, class_col], 
        how='left'
    )
    
    mhc_status_col = find_column_by_keywords(df_charges, ['MHC STATUS'], exact_match=True)
    if mhc_status_col is None:
        mhc_status_col = find_column_by_keywords(df_charges, ['MHC', 'STATUS'])
    
    outcome_col = find_column_by_keywords(df_charges, ['NG/DISMISSED'], exact_match=True)
    if outcome_col is None:
        outcome_col = find_column_by_keywords(df_charges, ['DISMISSED', 'OUTCOME'])
    
    print(f"Using '{mhc_status_col}' for MHC status and '{outcome_col}' for outcome")
    
    participant_charge_cols = ['Participant_ID', 'Offense_ID', charge_date_col]
    
    if mhc_status_col:
        participant_charge_cols.append(mhc_status_col)
    if outcome_col:
        participant_charge_cols.append(outcome_col)
    
    df_participant_charge = df_merged[participant_charge_cols].copy()
    
    rename_dict = {}
    
    if charge_date_col in df_participant_charge.columns:
        rename_dict[charge_date_col] = 'Charge_Date'
    
    if mhc_status_col and mhc_status_col in df_participant_charge.columns:
        rename_dict[mhc_status_col] = 'Status_at_Charge'
    if outcome_col and outcome_col in df_participant_charge.columns:
        rename_dict[outcome_col] = 'Outcome'
    
    df_participant_charge.rename(columns=rename_dict, inplace=True)
    
    if 'Charge_Date' in df_participant_charge.columns:
        df_participant_charge['Charge_Date'] = pd.to_datetime(df_participant_charge['Charge_Date'], errors='coerce').dt.strftime('%Y-%m-%d')
    
    if 'Outcome' in df_participant_charge.columns:
        df_participant_charge['Outcome'] = df_participant_charge['Outcome'].astype(str).str.replace('G/Convicted', 'Convicted', regex=False).str.strip()
    
    insert_cols = ['Participant_ID', 'Offense_ID']
    if 'Charge_Date' in df_participant_charge.columns:
        insert_cols.append('Charge_Date')
    if 'Status_at_Charge' in df_participant_charge.columns:
        insert_cols.append('Status_at_Charge')
    if 'Outcome' in df_participant_charge.columns:
        insert_cols.append('Outcome')
    
    df_participant_charge[insert_cols].to_sql(
        'PARTICIPANT_CHARGE', 
        conn, 
        if_exists='replace', 
        index=False
    )
    
    print(f"Successfully loaded {len(df_participant_charge)} participant charge records.")


def load_mental_health_data(conn):
    """Loads mental health diagnosis data from MHC_Mental_Health_Entry.csv."""
    print("[4] Loading MENTAL HEALTH DIAGNOSIS data...")
    
    try:
        df_mh = pd.read_csv("MHC_Mental_Health_Entry.csv", header=0, skipinitialspace=True)
        df_mh.columns = df_mh.columns.str.strip()
        
        print("--- DEBUG: MENTAL HEALTH DATA COLUMNS ---")
        print(df_mh.columns.tolist())
        print("----------------------------------------")
        
    except FileNotFoundError:
        print("MHC_Mental_Health_Entry.csv not found. Skipping mental health data load.")
        return
    
    name_col = find_column_by_keywords(df_mh, ['NAME', 'PARTICIPANT'])
    if name_col is None:
        print("Could not find participant name column in mental health data.")
        return
    
    df_mh['Participant_ID'] = df_mh[name_col].apply(create_participant_id)
    
    diag_code_col = find_column_by_keywords(df_mh, ['DIAGNOSIS', 'CODE', 'DX'])
    diag_desc_col = find_column_by_keywords(df_mh, ['DIAGNOSIS', 'DESCRIPTION', 'CONDITION'])
    date_col = find_column_by_keywords(df_mh, ['DATE', 'ASSESSMENT', 'ENTRY'])
    
    if diag_code_col is None:
        print("Could not find diagnosis code column.")
        return
    
    df_mh_clean = df_mh.copy()
    df_mh_clean['Diagnosis_Code'] = df_mh_clean[diag_code_col].astype(str).str.strip()
    
    if diag_desc_col:
        df_mh_clean['Diagnosis_Description'] = df_mh_clean[diag_desc_col].astype(str).str.strip()
    else:
        df_mh_clean['Diagnosis_Description'] = None
    
    if date_col:
        df_mh_clean['Assessment_Date'] = pd.to_datetime(df_mh_clean[date_col], errors='coerce').dt.strftime('%Y-%m-%d')
    else:
        df_mh_clean['Assessment_Date'] = None
    
    mh_cols = ['Participant_ID', 'Diagnosis_Code', 'Diagnosis_Description', 'Assessment_Date']
    df_mh_to_insert = df_mh_clean[mh_cols].copy()
    
    df_mh_to_insert = df_mh_to_insert.dropna(subset=['Diagnosis_Code', 'Participant_ID'])
    
    df_mh_to_insert.to_sql(
        'PARTICIPANT_DIAGNOSIS',
        conn,
        if_exists='replace',
        index=False
    )
    
    print(f"Successfully loaded {len(df_mh_to_insert)} mental health diagnosis records.")


def load_risk_assessments(conn):
    """Loads LS/CMI risk assessment data from MHC_Risk_Assessment.csv."""
    print("[5] Loading RISK ASSESSMENT data...")
    
    try:
        df_risk = pd.read_csv("MHC_Risk_Assessment.csv", header=0, skipinitialspace=True)
        df_risk.columns = df_risk.columns.str.strip()
        
        print("--- DEBUG: RISK ASSESSMENT COLUMNS ---")
        print(df_risk.columns.tolist())
        print("--------------------------------------")
        
    except FileNotFoundError:
        print("MHC_Risk_Assessment.csv not found. Skipping risk assessment load.")
        return
    
    name_col = find_column_by_keywords(df_risk, ['NAME', 'PARTICIPANT'])
    if name_col is None:
        print("Could not find participant name column in risk assessment data.")
        return
    
    df_risk['Participant_ID'] = df_risk[name_col].apply(create_participant_id)
    
    date_col = find_column_by_keywords(df_risk, ['DATE', 'ASSESSMENT'])
    score_col = find_column_by_keywords(df_risk, ['SCORE', 'LS/CMI', 'LS CMI', 'RISK'])
    category_col = find_column_by_keywords(df_risk, ['CATEGORY', 'LEVEL', 'RISK LEVEL'])
    
    df_risk_clean = df_risk.copy()
    
    if date_col:
        df_risk_clean['Assessment_Date'] = pd.to_datetime(df_risk_clean[date_col], errors='coerce').dt.strftime('%Y-%m-%d')
    else:
        df_risk_clean['Assessment_Date'] = None
    
    if score_col:
        df_risk_clean['Risk_Score'] = pd.to_numeric(df_risk_clean[score_col], errors='coerce')
    else:
        df_risk_clean['Risk_Score'] = None
    
    if category_col:
        df_risk_clean['Risk_Category'] = df_risk_clean[category_col].astype(str).str.strip()
    else:
        df_risk_clean['Risk_Category'] = None
    
    risk_cols = ['Participant_ID', 'Assessment_Date', 'Risk_Score', 'Risk_Category']
    df_risk_to_insert = df_risk_clean[risk_cols].copy()
    
    df_risk_to_insert = df_risk_to_insert.dropna(subset=['Participant_ID'])
    
    df_risk_to_insert.to_sql(
        'RISK_ASSESSMENT',
        conn,
        if_exists='replace',
        index=False
    )
    
    print(f"Successfully loaded {len(df_risk_to_insert)} risk assessment records.")


def load_jail_data(conn):
    """Loads jail data from MHC_Jail_Data_Tracking.csv."""
    print("[6] Loading JAIL DATA...")
    
    try:
        df_jail = pd.read_csv("MHC_Jail_Data_Tracking.csv", header=0, skipinitialspace=True)
        df_jail.columns = df_jail.columns.str.strip()
        
        print("--- DEBUG: JAIL DATA COLUMNS ---")
        print(df_jail.columns.tolist())
        print("-------------------------------")
        
    except FileNotFoundError:
        print("MHC_Jail_Data_Tracking.csv not found. Skipping jail data load.")
        return
    
    name_col = find_column_by_keywords(df_jail, ['NAME', 'PARTICIPANT'])
    if name_col is None:
        print("Could not find participant name column in jail data.")
        return
    
    df_jail['Participant_ID'] = df_jail[name_col].apply(create_participant_id)
    
    start_date_col = find_column_by_keywords(df_jail, ['START', 'BEGIN', 'ADMISSION', 'FROM'])
    end_date_col = find_column_by_keywords(df_jail, ['END', 'RELEASE', 'TO', 'DISCHARGE'])
    days_col = find_column_by_keywords(df_jail, ['DAYS', 'LENGTH', 'DURATION'])
    cost_col = find_column_by_keywords(df_jail, ['COST', 'AMOUNT', 'FEE', 'CHARGE'])
    
    df_jail_clean = df_jail.copy()
    
    if start_date_col:
        df_jail_clean['Start_Date'] = pd.to_datetime(df_jail_clean[start_date_col], errors='coerce').dt.strftime('%Y-%m-%d')
    else:
        df_jail_clean['Start_Date'] = None
    
    if end_date_col:
        df_jail_clean['End_Date'] = pd.to_datetime(df_jail_clean[end_date_col], errors='coerce').dt.strftime('%Y-%m-%d')
    else:
        df_jail_clean['End_Date'] = None
    
    if days_col:
        df_jail_clean['Days_Incarcerated'] = pd.to_numeric(df_jail_clean[days_col], errors='coerce')
    else:
        df_jail_clean['Days_Incarcerated'] = None
    
    if cost_col:
        df_jail_clean['Cost'] = pd.to_numeric(df_jail_clean[cost_col], errors='coerce')
    else:
        df_jail_clean['Cost'] = None
    
    if 'Days_Incarcerated' not in df_jail_clean.columns or df_jail_clean['Days_Incarcerated'].isna().all():
        if 'Start_Date' in df_jail_clean.columns and 'End_Date' in df_jail_clean.columns:
            start_dates = pd.to_datetime(df_jail_clean['Start_Date'], errors='coerce')
            end_dates = pd.to_datetime(df_jail_clean['End_Date'], errors='coerce')
            df_jail_clean['Days_Incarcerated'] = (end_dates - start_dates).dt.days
    
    jail_cols = ['Participant_ID', 'Start_Date', 'End_Date', 'Days_Incarcerated', 'Cost']
    df_jail_to_insert = df_jail_clean[jail_cols].copy()
    
    df_jail_to_insert = df_jail_to_insert.dropna(subset=['Participant_ID'])
    
    df_jail_to_insert.to_sql(
        'JAIL_DATA',
        conn,
        if_exists='replace',
        index=False
    )
    
    print(f"Successfully loaded {len(df_jail_to_insert)} jail data records.")


def load_treatment_episodes(conn):
    """Loads treatment episodes from MHC_Treatment files."""
    print("[7] Loading TREATMENT EPISODES data...")
    
    treatment_files = [
        'MHC_Treatment_MH_FY23.csv',
        'MHC_Treatment_MH_FY24.csv',
        'MHC_Treatment_MH_FY25.csv',
        'MHC_Treatment_CD_FY23.csv',
        'MHC_Treatment_CD_FY24.csv',
        'MHC_Treatment_CD_FY25.csv',
        'MHC_Treatment_Historical.csv'
    ]
    
    all_treatments = []
    
    for file in treatment_files:
        try:
            df_treatment = pd.read_csv(file, header=0, skipinitialspace=True)
            df_treatment.columns = df_treatment.columns.str.strip()
            
            print(f"--- Processing {file} ---")
            print(f"Columns: {df_treatment.columns.tolist()[:10]}...")
            
            name_col = find_column_by_keywords(df_treatment, ['NAME', 'PARTICIPANT', 'CLIENT'])
            if name_col is None:
                print(f"Could not find participant name column in {file}. Skipping.")
                continue
            
            df_treatment['Participant_ID'] = df_treatment[name_col].apply(create_participant_id)
            
            start_date_col = find_column_by_keywords(df_treatment, ['START', 'BEGIN', 'ADMISSION', 'DATE'])
            end_date_col = find_column_by_keywords(df_treatment, ['END', 'COMPLETION', 'DISCHARGE'])
            type_col = find_column_by_keywords(df_treatment, ['TYPE', 'SERVICE', 'TREATMENT', 'MODALITY'])
            provider_col = find_column_by_keywords(df_treatment, ['PROVIDER', 'FACILITY', 'AGENCY'])
            outcome_col = find_column_by_keywords(df_treatment, ['OUTCOME', 'RESULT', 'STATUS', 'COMPLETION'])
            
            df_treatment_clean = df_treatment.copy()
            
            if 'MH' in file:
                df_treatment_clean['Treatment_Type'] = 'Mental Health'
            elif 'CD' in file:
                df_treatment_clean['Treatment_Type'] = 'Chemical Dependency'
            else:
                df_treatment_clean['Treatment_Type'] = 'Unknown'
            
            if start_date_col:
                df_treatment_clean['Start_Date'] = pd.to_datetime(df_treatment_clean[start_date_col], errors='coerce').dt.strftime('%Y-%m-%d')
            else:
                df_treatment_clean['Start_Date'] = None
            
            if end_date_col:
                df_treatment_clean['End_Date'] = pd.to_datetime(df_treatment_clean[end_date_col], errors='coerce').dt.strftime('%Y-%m-%d')
            else:
                df_treatment_clean['End_Date'] = None
            
            if type_col:
                df_treatment_clean['Service_Type'] = df_treatment_clean[type_col].astype(str).str.strip()
            else:
                df_treatment_clean['Service_Type'] = None
            
            if provider_col:
                df_treatment_clean['Provider'] = df_treatment_clean[provider_col].astype(str).str.strip()
            else:
                df_treatment_clean['Provider'] = None
            
            if outcome_col:
                df_treatment_clean['Outcome'] = df_treatment_clean[outcome_col].astype(str).str.strip()
            else:
                df_treatment_clean['Outcome'] = None
            
            treatment_cols = ['Participant_ID', 'Treatment_Type', 'Start_Date', 'End_Date', 
                            'Service_Type', 'Provider', 'Outcome']
            df_treatment_selected = df_treatment_clean[treatment_cols].copy()
            
            df_treatment_selected = df_treatment_selected.dropna(subset=['Participant_ID'])
            
            all_treatments.append(df_treatment_selected)
            
            print(f"Loaded {len(df_treatment_selected)} records from {file}")
            
        except FileNotFoundError:
            print(f"{file} not found. Skipping.")
            continue
        except Exception as e:
            print(f"Error processing {file}: {e}")
            continue
    
    if all_treatments:
        df_all_treatments = pd.concat(all_treatments, ignore_index=True)
        
        df_all_treatments.to_sql(
            'TREATMENT_EPISODE',
            conn,
            if_exists='replace',
            index=False
        )
        
        print(f"Successfully loaded {len(df_all_treatments)} total treatment episode records.")
    else:
        print("No treatment data was loaded.")


def load_psychosocial_assessments(conn):
    """Loads psychosocial assessment data from MHC_Psychosocial_Assessment.csv."""
    print("[8] Loading PSYCHOSOCIAL ASSESSMENT data...")
    
    try:
        df_psych = pd.read_csv("MHC_Psychosocial_Assessment.csv", header=0, skipinitialspace=True)
        df_psych.columns = df_psych.columns.str.strip()
        
        print("--- DEBUG: PSYCHOSOCIAL ASSESSMENT COLUMNS ---")
        print(df_psych.columns.tolist())
        print("------------------------------------------------")
        
    except FileNotFoundError:
        print("MHC_Psychosocial_Assessment.csv not found. Skipping psychosocial assessment load.")
        return
    
    name_col = find_column_by_keywords(df_psych, ['NAME', 'PARTICIPANT', 'CLIENT'])
    if name_col is None:
        print("Could not find participant name column in psychosocial assessment data.")
        return
    
    df_psych['Participant_ID'] = df_psych[name_col].apply(create_participant_id)
    
    date_col = find_column_by_keywords(df_psych, ['DATE', 'ASSESSMENT', 'COMPLETED'])
    
    df_psych_clean = df_psych.copy()
    
    if date_col:
        df_psych_clean['Assessment_Date'] = pd.to_datetime(df_psych_clean[date_col], errors='coerce').dt.strftime('%Y-%m-%d')
    else:
        df_psych_clean['Assessment_Date'] = None
    
    psych_cols = ['Participant_ID', 'Assessment_Date']
    
    other_cols = [col for col in df_psych_clean.columns 
                 if col not in ['Participant_ID', 'Assessment_Date', name_col] 
                 and col != date_col][:10]
    
    psych_cols.extend(other_cols)
    
    df_psych_to_insert = df_psych_clean[psych_cols].copy()
    
    df_psych_to_insert = df_psych_to_insert.dropna(subset=['Participant_ID'])
    
    df_psych_to_insert.to_sql(
        'PSYCHOSOCIAL_ASSESSMENT',
        conn,
        if_exists='replace',
        index=False
    )
    
    print(f"Successfully loaded {len(df_psych_to_insert)} psychosocial assessment records.")


# --- Main Execution Block ---

if __name__ == '__main__':
    load_data()