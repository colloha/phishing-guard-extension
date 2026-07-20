import pandas as pd
import os

# --- CONFIGURATION ---
# Change these to match the exact column names in your CSV files that contain the email body
SAFE_TEXT_COLUMN = 'text'  # Update if email_text.csv uses a different name
PHISH_TEXT_COLUMN = 'body' # Update if Nazario_5.csv uses a different name

RAW_DATA_DIR = 'raw_data'
SAFE_CSV = os.path.join(RAW_DATA_DIR, 'email_text.csv')
PHISH_CSV = os.path.join(RAW_DATA_DIR, 'Nazario_5.csv')
OUTPUT_CSV = 'dataset.csv'

def create_dataset():
    print("Loading raw datasets...")
    
    try:
        # Load Safe Emails
        safe_df = pd.read_csv(SAFE_CSV)
        # Rename the text column to our standard 'text'
        safe_df = safe_df.rename(columns={SAFE_TEXT_COLUMN: 'text'})
        # Keep only the text column and drop empty rows
        safe_df = safe_df[['text']].dropna()
        # Add the label (0 = Safe)
        safe_df['label'] = 0
        print(f"Loaded {len(safe_df)} legitimate emails.")

        # Load Phishing Emails
        phish_df = pd.read_csv(PHISH_CSV)
        # Rename the text column to our standard 'text'
        phish_df = phish_df.rename(columns={PHISH_TEXT_COLUMN: 'text'})
        # Keep only the text column and drop empty rows
        phish_df = phish_df[['text']].dropna()
        # Add the label (1 = Phishing)
        phish_df['label'] = 1
        print(f"Loaded {len(phish_df)} phishing emails.")

    except FileNotFoundError as e:
        print(f"Error: Could not find file. {e}")
        return
    except KeyError as e:
        print(f"Error: Column not found. Make sure SAFE_TEXT_COLUMN and PHISH_TEXT_COLUMN match your CSV headers. {e}")
        return

    # Balance the dataset (optional but recommended)
    # We truncate the larger dataset to match the size of the smaller one
    min_size = min(len(safe_df), len(phish_df))
    print(f"\nBalancing dataset to {min_size} samples per class...")
    safe_df = safe_df.sample(n=min_size, random_state=42)
    phish_df = phish_df.sample(n=min_size, random_state=42)

    # Combine and shuffle
    combined_df = pd.concat([safe_df, phish_df])
    combined_df = combined_df.sample(frac=1, random_state=42).reset_index(drop=True)

    # Save to final dataset.csv
    combined_df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nSuccess! Saved {len(combined_df)} total records to {OUTPUT_CSV}")

if __name__ == '__main__':
    create_dataset()