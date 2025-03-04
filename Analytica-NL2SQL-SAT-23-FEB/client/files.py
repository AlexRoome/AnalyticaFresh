import os

# Specify the root directory of your project
replit_project_dir = './'  # Start from the root of your Replit project

# Create a new file to store the combined contents
output_file = 'combined_replit_files.txt'

# Open the output file in write mode
with open(output_file, 'w', encoding='utf-8') as combined_file:
    # Walk through all files in the project directory and subdirectories
    for root, dirs, files in os.walk(replit_project_dir):
        # Skip the 'gantt' directory and any Gantt-related files
        if 'gantt' in root:
            continue

        for file in files:
            # Skip any Gantt-related files by name
            if 'Gant' in file or 'gantt' in file:
                continue

            # Full file path
            file_path = os.path.join(root, file)
            print(f"Processing file: {file_path}")  # Debug print

            try:
                # Open each file and write its contents into the combined file
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    combined_file.write(f"--- {file_path} ---\n")
                    combined_file.write(content + "\n\n")
            except Exception as e:
                print(f"Could not read {file_path}: {e}")

print(f"All files (excluding Gantt) have been exported to {output_file}.")
