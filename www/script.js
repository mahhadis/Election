const GOOGLE_CLIENT_ID = "856362738407-kitu3c7k6if7cgbn9gsq3eq7o3vb1qlr.apps.googleusercontent.com";
let recordList = JSON.parse(localStorage.getItem('election_records')) || [];
let editIndex = null;
let cachedAccessToken = null;

// Toast Notification Helper
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = "show";
  setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

// Visual Sync Status Manager
function updateSyncBadge(status) {
  const badge = document.getElementById("syncStatus");
  if (!badge) return;
  if (status === 'synced') {
    badge.textContent = "🟢 Drive Synced";
    badge.style.background = "#15803d";
  } else if (status === 'pending') {
    badge.textContent = "🟡 Sync Pending";
    badge.style.background = "#b45309";
  } else if (status === 'syncing') {
    badge.textContent = "⏳ Syncing...";
    badge.style.background = "#1d4ed8";
  }
}

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

// 2. Drive Background Sync Engine
async function triggerAutoDriveSync() {
  if (!navigator.onLine) {
    updateSyncBadge('pending');
    return;
  }

  if (!cachedAccessToken) {
    initiateGoogleAuth(true);
    return;
  }

  await uploadBackupToDrive(cachedAccessToken, true);
}

function initiateGoogleAuth(isBackgroundSync = false) {
  if (typeof google === 'undefined' || !google.accounts) return;

  updateSyncBadge('syncing');
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: async (response) => {
      if (response.access_token) {
        cachedAccessToken = response.access_token;
        await uploadBackupToDrive(cachedAccessToken, isBackgroundSync);
      } else {
        updateSyncBadge('pending');
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
      updateSyncBadge('synced');
      if (!isSilent) showToast('গুগল ড্রাইভে সফলভাবে ব্যাকআপ হয়েছে!');
    } else {
      updateSyncBadge('pending');
      if (res.status === 401) cachedAccessToken = null; // Token expired, reset cache
      if (!isSilent) showToast('ড্রাইভ ব্যাকআপ ব্যাহত হয়েছে!');
    }
  } catch (err) {
    updateSyncBadge('pending');
    if (!isSilent) showToast('ড্রাইভ সিঙ্ক করতে সমস্যা হয়েছে!');
  }
}

// 3. Form Validation, Input Checks & Submission
function handleFormSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('voterName').value.trim();
  const phone = document.getElementById('voterPhone').value.trim();
  const ward = document.getElementById('wardNo').value;

  // Bangladeshi Mobile Number Validation Logic
  const bdPhoneRegex = /^01[3-9]\d{8}$/;
  if (!bdPhoneRegex.test(phone)) {
    showToast('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন!');
    return;
  }

  // Duplicate Number Detection (skips edit target)
  const isDuplicate = recordList.some((rec, idx) => rec.phone === phone && idx !== editIndex);
  if (isDuplicate) {
    showToast('এই নম্বরটি ইতিমধ্যে সংরক্ষিত আছে!');
    return;
  }

  const recordData = { name, phone, ward, timestamp: new Date().toLocaleString('bn-BD') };

  if (editIndex !== null) {
    recordList[editIndex] = recordData;
    editIndex = null;
    document.querySelector('.btn-submit').textContent = '💾 সংরক্ষণ করুন';
    showToast('ডাটা সফলভাবে আপডেট করা হয়েছে');
  } else {
    recordList.push(recordData);
    showToast('নতুন ভোটার সফলভাবে যুক্ত হয়েছে');
  }

  localStorage.setItem('election_records', JSON.stringify(recordList));
  document.getElementById('voterForm').reset();
  clearFormDrafts();
  filterRecords();
  triggerAutoDriveSync();
}

// 4. Render Table & Counter
function renderRecordsTable(dataToRender) {
  const tbody = document.getElementById('tableBody');
  const counter = document.getElementById('recordCounter');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (counter) counter.textContent = `প্রদর্শিত: ${dataToRender.length} / ${recordList.length}`;

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

// 5. In-Place Edit & Delete Actions
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
    showToast('রেকর্ড মুছে ফেলা হয়েছে');
    triggerAutoDriveSync();
  }
}

// 6. Exports
function exportToExcel() {
  if (recordList.length === 0) {
    showToast('রপ্তানি করার জন্য কোনো ডাটা পাওয়া যায়নি!');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(recordList);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Election Records");
  XLSX.writeFile(workbook, `Election_Data_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportToPDF() {
  if (recordList.length === 0) {
    showToast('PDF তৈরি করার জন্য কোনো ডাটা পাওয়া যায়নি!');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Election Management Summary Report", 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated Date: ${new Date().toLocaleString()}`, 14, 22);
  doc.text(`Total Records: ${recordList.length}`, 14, 28);
  doc.setLineWidth(0.5);
  doc.line(14, 32, 196, 32);

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
    showToast('কোনো ডাটা নেই!');
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

// 7. Network Monitor & App Init
function updateOnlineStatus() {
  const banner = document.getElementById('offline-banner');
  if (banner) {
    banner.style.display = navigator.onLine ? 'none' : 'block';
  }
  if (!navigator.onLine) updateSyncBadge('pending');
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

document.addEventListener('DOMContentLoaded', () => {
  updateOnlineStatus();
  restoreFormDrafts();
  filterRecords();
});
