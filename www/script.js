const GOOGLE_CLIENT_ID = "856362738407-kitu3c7k6if7cgbn9gsq3eq7o3vb1qlr.apps.googleusercontent.com";
let recordList = JSON.parse(localStorage.getItem('election_records')) || [];
let editIndex = null;
let cachedAccessToken = null; // Stores OAuth token for real-time background syncing

// 1. Form Draft Auto-Save Functions
function autoSaveFormInput(fieldId) {
  const inputElement = document.getElementById(fieldId);
  if (inputElement) {
    localStorage.setItem('draft_' + fieldId, inputElement.value);
  }
}

function restoreFormDrafts() {
  ['voterName', 'voterPhone', 'wardNo'].forEach(id => {
    const savedValue = localStorage.getItem('draft_' + id);
    const inputElement = document.getElementById(id);
    if (savedValue && inputElement) {
      inputElement.value = savedValue;
    }
  });
}

function clearFormDrafts() {
  ['voterName', 'voterPhone', 'wardNo'].forEach(id => {
    localStorage.removeItem('draft_' + id);
  });
}

// 2. Real-Time Google Drive Background Sync Logic
async function triggerAutoDriveSync() {
  if (!navigator.onLine) return; // Skip if offline

  if (!cachedAccessToken) {
    initiateGoogleAuth(true);
    return;
  }

  await uploadBackupToDrive(cachedAccessToken, true);
}

function initiateGoogleAuth(isBackgroundSync = false) {
  if (typeof google === 'undefined' || !google.accounts) return;

  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: async (response) => {
      if (response.access_token) {
        cachedAccessToken = response.access_token;
        await uploadBackupToDrive(cachedAccessToken, isBackgroundSync);
      }
    },
  });
  tokenClient.requestAccessToken();
}

function syncWithGoogleDrive() {
  initiateGoogleAuth(false);
}

async function uploadBackupToDrive(accessToken, isSilent = false) {
  const fileData = JSON.stringify(recordList, null, 2);
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
      if (!isSilent) alert('গুগল ড্রাইভে সফলভাবে ডাটা ব্যাকআপ হয়েছে!');
    } else if (!isSilent) {
      alert('ড্রাইভ ব্যাকআপ ব্যাহত হয়েছে।');
    }
  } catch (err) {
    if (!isSilent) alert('ড্রাইভ সিঙ্ক করতে সমস্যা হয়েছে!');
  }
}

// 3. Add / Edit Record Handling with Real-Time Sync Hook
function handleFormSubmit(event) {
  event.preventDefault();

  const recordData = {
    name: document.getElementById('voterName').value.trim(),
    phone: document.getElementById('voterPhone').value.trim(),
    ward: document.getElementById('wardNo').value,
    timestamp: new Date().toLocaleString('bn-BD')
  };

  if (editIndex !== null) {
    recordList[editIndex] = recordData;
    editIndex = null;
    document.querySelector('.btn-submit').textContent = '💾 সংরক্ষণ করুন';
  } else {
    recordList.push(recordData);
  }

  localStorage.setItem('election_records', JSON.stringify(recordList));
  document.getElementById('voterForm').reset();
  clearFormDrafts();
  filterRecords();

  // Automatic Real-Time Drive Backup Trigger
  triggerAutoDriveSync();
}

// 4. Table Rendering & Filter Logic
function renderRecordsTable(dataToRender) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  dataToRender.forEach((item) => {
    const originalIndex = recordList.indexOf(item);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.name || '-'}</td>
      <td>${item.phone ? `<a href="tel:${item.phone}">${item.phone}</a>` : '-'}</td>
      <td>${item.ward || '-'}</td>
      <td>
        <div class="action-btn-group">
          <button onclick="editRecord(${originalIndex})" style="background: #eab308; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">✏️</button>
          <button onclick="deleteRecord(${originalIndex})" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function filterRecords() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const selectedWard = document.getElementById('filterWard').value;

  const filtered = recordList.filter(item => {
    const matchesQuery = (item.name && item.name.toLowerCase().includes(query)) ||
                         (item.phone && item.phone.includes(query));
    const matchesWard = selectedWard === "" || item.ward === selectedWard;
    return matchesQuery && matchesWard;
  });

  renderRecordsTable(filtered);
}

// 5. In-Place Edit & Delete Actions with Real-Time Sync Hook
function editRecord(index) {
  const item = recordList[index];
  document.getElementById('voterName').value = item.name || '';
  document.getElementById('voterPhone').value = item.phone || '';
  document.getElementById('wardNo').value = item.ward || '';
  
  editIndex = index;
  document.querySelector('.btn-submit').textContent = '🔄 আপডেট করুন';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteRecord(index) {
  if (confirm('আপনি কি এই ভোটার রেকর্ডটি মুছে ফেলতে চান?')) {
    recordList.splice(index, 1);
    localStorage.setItem('election_records', JSON.stringify(recordList));
    filterRecords();

    // Automatic Real-Time Drive Backup Trigger
    triggerAutoDriveSync();
  }
}

// 6. Exports (Excel, PDF, JSON)
function exportToExcel() {
  if (recordList.length === 0) {
    alert('রপ্তানি করার জন্য কোনো ডাটা পাওয়া যায়নি!');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(recordList);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Election Records");
  XLSX.writeFile(workbook, `Election_Data_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportToPDF() {
  if (recordList.length === 0) {
    alert('PDF তৈরি করার জন্য কোনো ডাটা পাওয়া যায়নি!');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Custom Header Format
  doc.setFontSize(16);
  doc.text("Election Management Summary Report", 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated Date: ${new Date().toLocaleString()}`, 14, 22);
  doc.text(`Total Records: ${recordList.length}`, 14, 28);
  doc.setLineWidth(0.5);
  doc.line(14, 32, 196, 32);

  // Table Structure
  const tableData = recordList.map((item, i) => [
    i + 1,
    item.name || '-',
    item.phone || '-',
    item.ward || '-',
    item.timestamp || '-'
  ]);

  doc.autoTable({
    startY: 36,
    head: [['#', 'Name', 'Phone', 'Ward', 'Saved Time']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59] }
  });

  doc.save(`Election_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function exportToJSON() {
  if (recordList.length === 0) {
    alert('কোনো ডাটা নেই!');
    return;
  }
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(recordList, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `Election_Data_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// 7. Connectivity Monitor & Initialization
function updateOnlineStatus() {
  const banner = document.getElementById('offline-banner');
  if (banner) {
    banner.style.display = navigator.onLine ? 'none' : 'block';
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

document.addEventListener('DOMContentLoaded', () => {
  updateOnlineStatus();
  restoreFormDrafts();
  filterRecords();
});
