// Google OAuth Client Configuration
const GOOGLE_CLIENT_ID = "856362738407-kitu3c7k6if7cgbn9gsq3eq7o3vb1qlr.apps.googleusercontent.com";

// 1. Auto-Save Draft to Local Storage
function autoSaveFormInput(fieldId) {
  const inputElement = document.getElementById(fieldId);
  if (inputElement) {
    localStorage.setItem('draft_' + fieldId, inputElement.value);
  }
}

function restoreFormDrafts(fieldIds) {
  fieldIds.forEach(id => {
    const savedValue = localStorage.getItem('draft_' + id);
    const inputElement = document.getElementById(id);
    if (savedValue && inputElement) {
      inputElement.value = savedValue;
    }
  });
}

function clearFormDrafts(fieldIds) {
  fieldIds.forEach(id => {
    localStorage.removeItem('draft_' + id);
  });
}

// 2. Offline / Online Status Monitoring
function updateOnlineStatus() {
  const banner = document.getElementById('offline-banner');
  if (banner) {
    banner.style.display = navigator.onLine ? 'none' : 'block';
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Restore draft data & check status when page loads
document.addEventListener('DOMContentLoaded', () => {
  updateOnlineStatus();
  restoreFormDrafts(['voterName', 'wardNo']);
});

// 3. Export Data to Excel (.xlsx)
function exportToExcel() {
  const dataToExport = typeof recordList !== 'undefined' ? recordList : [localStorage];
  
  if (!dataToExport || dataToExport.length === 0) {
    alert('রপ্তানি করার জন্য কোনো ডাটা পাওয়া যায়নি!');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Records");

  const fileName = `Election_Data_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

// 4. Export Data to JSON File
function exportToJSON() {
  const dataToExport = typeof recordList !== 'undefined' ? recordList : localStorage;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
  const downloadAnchor = document.createElement('a');
  
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `Election_Data_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// 5. Google Drive Integration
function syncWithGoogleDrive() {
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: async (response) => {
      if (response.access_token) {
        await uploadBackupToDrive(response.access_token);
      }
    },
  });
  tokenClient.requestAccessToken();
}

async function uploadBackupToDrive(accessToken) {
  const dataToBackup = typeof recordList !== 'undefined' ? recordList : localStorage;
  const fileData = JSON.stringify(dataToBackup, null, 2);
  const metadata = {
    name: `Election_Data_Backup_${new Date().toISOString().slice(0, 10)}.json`,
    mimeType: 'application/json'
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([fileData], { type: 'application/json' }));

  try {
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + accessToken },
      body: form
    });
    if (res.ok) {
      alert('গুগল ড্রাইভে সফলভাবে ডাটা ব্যাকআপ হয়েছে!');
    } else {
      alert('ড্রাইভ ব্যাকআপ ব্যাহত হয়েছে।');
    }
  } catch (err) {
    alert('ড্রাইভ সিঙ্ক করতে সমস্যা হয়েছে!');
  }
}
