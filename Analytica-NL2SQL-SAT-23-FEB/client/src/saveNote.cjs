const fs = require('fs');
const path = require('path');

// Get the project root directory
const projectRoot = path.resolve(__dirname, '..');

// Create a log entry
const logEntry = `
=============================================================
DATE: ${new Date().toISOString()}
CHANGE: DROPDOWN WORKING MANAGEMENT COSTS AR
DESCRIPTION: Programme column in table 2 of management costs page now uses a dropdown with gantt programme items
DEVELOPER: AR
=============================================================
`;

// Write to a changelog file
const changelogPath = path.join(projectRoot, 'CHANGELOG.md');

try {
  // Check if file exists and create it if not
  if (!fs.existsSync(changelogPath)) {
    fs.writeFileSync(changelogPath, '# Change Log\n\n');
  }
  
  // Append the log entry
  fs.appendFileSync(changelogPath, logEntry);
  console.log('Successfully saved note to CHANGELOG.md');
} catch (err) {
  console.error('Error saving note:', err);
} 