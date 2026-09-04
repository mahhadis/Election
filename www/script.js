// Application State
let voters = JSON.parse(localStorage.getItem('votersData')) || [];
let editIndex = null;

// DOM Elements
const voterForm = document.getElementById('voterForm');
const voterName = document.getElementById('voterName');
const voterPhone = document.getElementById('voterPhone');
const wardSelect = document.getElementById('wardSelect');
const gramSelect = document.getElementById('gramSelect');
const voterGosthi = document.getElementById('voterGosthi');
const voterNote = document.getElementById('voterNote');
const submitBtn = document.getElementById('submitBtn');

const voterTableBody = document.getElementById('voterTableBody');
const recordCount = document.getElementById('recordCount');
const searchInput = document.getElementById('searchInput');
const wardFilter = document.getElementById('wardFilter');

const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

// 1. Theme Management (System Awareness + Manual Override)
function initTheme() {
  const savedTheme = localStorage.getItem('appTheme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    // System Theme Match
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('appTheme', theme);
}

themeToggle.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

// Listen for OS Theme Changes if no explicit saved theme exists
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('appTheme')) {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});

// 2. Data Rendering & Filtering
function renderTable() {
  const query = searchInput.value.toLowerCase().trim();
  const selectedWard = wardFilter.value;

  voterTableBody.innerHTML = '';

  const filteredVoters = voters.filter(voter => {
    const matchesSearch = voter.name.toLowerCase().includes(query) ||
                          (voter.phone && voter.phone.includes(query)) ||
                          (voter.gosthi && voter.gosthi.toLowerCase().includes(query));
    const matchesWard = !selectedWard || voter.ward === selectedWard;
    return matchesSearch && matchesWard;
  });

  recordCount.textContent = `প্রদর্শিত: ${filteredVoters.length} / ${voters.length}`;

  if (filteredVoters.length === 0) {
    voterTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">কোন ডাটা পাওয়া যায়নি</td></tr>`;
    return;
  }

  filteredVoters.forEach((voter, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${voter.name}</strong></td>
      <td>${voter.phone ? `<a href="tel:${voter.phone}" class="phone-link">${voter.phone}</a>` : '-'}</td>
      <td>${voter.ward || '-'}</td>
      <td>${voter.gram || '-'}</td>
      <td>${voter.gosthi || '-'}</td>
      <td>
        <div class="action-btn-group">
          <button class="icon-btn btn-edit" onclick="editVoter(${voter.originalIndex})">✏️</button>
          <button class="icon-btn btn-delete" onclick="deleteVoter(${voter.originalIndex})">🗑️</button>
        </div>
      </td>
    `;
    voterTableBody.appendChild(tr);
  });
}

// Attach original indices for stable editing/deleting during search
function getIndexedVoters() {
  return voters.map((v, i) => ({ ...v, originalIndex: i }));
}

// 3. Form Submission (Create & Update)
voterForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const newVoter = {
    name: voterName.value.trim(),
    phone: voterPhone.value.trim(),
    ward: wardSelect.value,
    gram: gramSelect.value,
    gosthi: voterGosthi.value.trim(),
    note: voterNote.value.trim()
  };

  if (editIndex !== null) {
    voters[editIndex] = newVoter;
    editIndex = null;
    submitBtn.textContent = '💾 সংরক্ষণ করুন';
  } else {
    voters.unshift(newVoter);
  }

  saveAndRefresh();
  voterForm.reset();
});

function saveAndRefresh() {
  localStorage.setItem('votersData', JSON.stringify(voters));
  renderTable();
}

// Edit Record
window.editVoter = function(index) {
  const voter = voters[index];
  voterName.value = voter.name;
  voterPhone.value = voter.phone || '';
  wardSelect.value = voter.ward || '';
  gramSelect.value = voter.gram || '';
  voterGosthi.value = voter.gosthi || '';
  voterNote.value = voter.note || '';

  editIndex = index;
  submitBtn.textContent = '🔄 আপডেট করুন';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Delete Record
window.deleteVoter = function(index) {
  if (confirm('আপনি কি এই তথ্যটি মুছে ফেলতে চান?')) {
    voters.splice(index, 1);
    saveAndRefresh();
  }
};

// Search & Filter Listeners
searchInput.addEventListener('input', renderTable);
wardFilter.addEventListener('change', renderTable);

// 4. Capacitor Native Back Button Handling
document.addEventListener('deviceready', () => {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener('backButton', () => {
      if (editIndex !== null) {
        editIndex = null;
        voterForm.reset();
        submitBtn.textContent = '💾 সংরক্ষণ করুন';
      } else {
        window.Capacitor.Plugins.App.exitApp();
      }
    });
  }
});

// Initialization
initTheme();
renderTable();
