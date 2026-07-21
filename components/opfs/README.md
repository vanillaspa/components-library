# Personal Activity Tracker - OPFS Demo

A demonstration of ethical data tracking using the Origin Private File System (OPFS) API. This application shows how to build a tracking system that respects user privacy and provides full transparency and control over stored data.

## 🔒 Privacy-First Design

This application demonstrates the following ethical principles:

- **User Consent**: Users explicitly choose what activities to track
- **Transparency**: All stored data can be viewed and inspected
- **Control**: Users can export or delete their data at any time
- **Privacy**: Data never leaves the user's device and is stored privately in their browser

## 🚀 Features

- **Activity Tracking**: Log personal activities with timestamps
- **Data Visualization**: View all tracked activities in a clean interface
- **Statistics**: See total activities, today's activities, and storage usage
- **Data Export**: Export all data as JSON for backup or analysis
- **Data Management**: Clear all data with a single click
- **Responsive Design**: Works on desktop and mobile devices

## 🛠 Technical Implementation

### OPFS Integration

The application uses the Origin Private File System (OPFS) API to store data locally:

```javascript
// Get OPFS root directory
const opfsRoot = await navigator.storage.getDirectory();

// Create or get file handle
const fileHandle = await opfsRoot.getFileHandle('activities.json', { create: true });

// Write data
const writable = await fileHandle.createWritable();
await writable.write(JSON.stringify(data));
await writable.close();
```

### Key Components

1. **OPFSTracker Class**: Main application logic
2. **Data Storage**: JSON-based storage in OPFS
3. **UI Management**: Dynamic content updates
4. **Error Handling**: Graceful fallbacks and user feedback

## 📋 Browser Compatibility

This application requires a modern browser with OPFS support:

- ✅ Chrome 86+
- ✅ Edge 86+
- ✅ Firefox 111+
- ❌ Safari (limited support)

## 🏃‍♂️ Running the Application

### Option 1: Local HTTP Server (Recommended)

```bash
# Navigate to the project directory
cd opfs-tracking-app

# Start a local HTTP server
python3 -m http.server 8080

# Open in browser
# Navigate to http://localhost:8080
```

### Option 2: File Protocol (Limited)

You can open `index.html` directly in your browser, but OPFS functionality may be limited due to security restrictions.

## 📁 Project Structure

```
opfs-tracking-app/
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── script.js           # JavaScript application logic
└── README.md           # This file
```

## 🔧 How It Works

### 1. Initialization

When the page loads, the application:
- Checks for OPFS support
- Loads existing data from OPFS
- Initializes the user interface
- Binds event handlers

### 2. Activity Tracking

When a user tracks an activity:
- Input is validated and sanitized
- Activity data is created with timestamp
- Data is saved to OPFS
- UI is updated with new statistics

### 3. Data Management

Users can:
- View all tracked activities with timestamps
- Export data as JSON file
- Clear all data with confirmation
- See real-time storage usage statistics

## 🎯 Use Cases

This application can be adapted for various ethical tracking scenarios:

- **Personal Habit Tracking**: Exercise, reading, meditation
- **Work Activity Logging**: Tasks, meetings, breaks
- **Health Monitoring**: Symptoms, medications, mood
- **Learning Progress**: Study sessions, courses, skills
- **Creative Projects**: Writing, art, music practice

## 🔐 Security Considerations

- Data is stored locally using OPFS, never transmitted to servers
- No external dependencies or third-party services
- Input sanitization prevents XSS attacks
- User has full control over their data

## 🚫 What This App Does NOT Do

- Track users without explicit consent
- Send data to external servers
- Use cookies or other tracking mechanisms
- Access data from other websites
- Store personally identifiable information without user input

## 🛡 Ethical Guidelines

When building tracking applications:

1. **Always obtain explicit user consent**
2. **Provide clear privacy notices**
3. **Allow users to view all stored data**
4. **Enable easy data export and deletion**
5. **Minimize data collection to what's necessary**
6. **Use local storage when possible**
7. **Be transparent about data usage**

## 🐛 Debugging

The application includes debugging utilities accessible via the browser console:

```javascript
// List all files in OPFS
await window.debugOPFS.listFiles();

// Get storage usage estimate
await window.debugOPFS.getStorageEstimate();
```

## 📝 License

This project is provided as an educational example. Feel free to use and modify it for your own ethical tracking applications.

## 🤝 Contributing

This is a demonstration project, but suggestions for improving the ethical aspects or technical implementation are welcome.

---

**Remember**: With great power comes great responsibility. Use tracking technologies ethically and always respect user privacy and consent.

