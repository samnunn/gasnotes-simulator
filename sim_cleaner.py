import os
import time

base_path = "./sim_rooms"

# Calculate the current time in seconds since the epoch
current_time = time.time()

# Iterate over all files in the directory
for f in os.listdir(base_path):
    file_path = os.path.join(base_path, f)
    
    # Check if the file is a regular file and was last updated more than one hour ago
    if os.path.isfile(file_path) and current_time - os.path.getmtime(file_path) > 3600:
        # Delete the file
        os.remove(file_path)