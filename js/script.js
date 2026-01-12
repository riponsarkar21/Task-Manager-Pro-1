        // ========================
        // SUPABASE CONFIGURATION
        // ========================
        const SUPABASE_URL = 'https://lviiwltmcuypqxlngqpi.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_TKKOqT2n1X9ycoQsucar1w_d9ZivbaG';
        
        // Create Supabase client
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // ========================
        // LOCAL STORAGE KEYS
        // ========================
        const DB_KEY_TASKS = 'tm_tasks';
        const DB_KEY_LOGS = 'tm_logs';
        const DB_KEY_USERS = 'tm_users';
        const DB_KEY_CLOUD_ID = 'tm_cloud_id';
        const DB_KEY_LAST_SYNC = 'tm_last_sync';
        const DB_KEY_AUTH_USERS = 'tm_auth_users';
        const DB_KEY_CURRENT_USER = 'tm_current_user';

        // ========================
        // CONSTANTS
        // ========================
        const RESPONSIBILITIES = {
            TASK_MANAGEMENT: 'Task Management',
            USER_PROFILE: 'User Profile',
            LEAVE_MANAGEMENT: 'Leave Management',
            OVERTIME_MANAGEMENT: 'Overtime Management',
            KPI: 'KPI',
            USER_MANAGEMENT: 'User Management'
        };

        const ALL_RESPONSIBILITIES = Object.values(RESPONSIBILITIES);

        // ========================
        // APPLICATION STATE
        // ========================
        const state = {
            // Authentication state
            currentUser: null,
            authUsers: [],
            
            // Existing state
            currentShift: 'A',
            tasks: {}, 
            logs: [],
            users: [],
            currentChecks: new Set(),
            
            // Cloud state
            cloudConnected: false,
            cloudSyncing: false,
            cloudId: localStorage.getItem(DB_KEY_CLOUD_ID) || null,
            lastSync: localStorage.getItem(DB_KEY_LAST_SYNC) || null,
            
            // Home State
            homeMode: 'daily',
            homeUserFilter: 'ALL',
            sortKey: 'reportDate',
            sortOrder: 'desc',
            
            // Dashboard State
            dashboardMode: 'daily',
            dashboardUserFilter: '',
            dashboardSortKey: 'reportDate',
            dashboardSortOrder: 'desc'
        };

        // ========================
        // AUTHENTICATION MODULE
        // ========================
        const auth = {
            init: () => {
                // Load auth users from localStorage
                const storedUsers = localStorage.getItem(DB_KEY_AUTH_USERS);
                if (storedUsers) {
                    state.authUsers = JSON.parse(storedUsers);
                } else {
                    // Create default admin user
                    state.authUsers = [{
                        userId: 'admin',
                        name: 'Administrator',
                        designation: 'System Administrator',
                        department: 'IT',
                        phone: '',
                        email: '',
                        role: 'Administrator',
                        responsibilities: ALL_RESPONSIBILITIES,
                        password: 'admin', // Default password
                        isActive: true,
                        createdAt: new Date().toISOString(),
                        lastLogin: null
                    }];
                    localStorage.setItem(DB_KEY_AUTH_USERS, JSON.stringify(state.authUsers));
                }

                // Check if user is already logged in
                const storedUser = localStorage.getItem(DB_KEY_CURRENT_USER);
                if (storedUser) {
                    try {
                        const user = JSON.parse(storedUser);
                        const foundUser = state.authUsers.find(u => u.userId === user.userId);
                        if (foundUser && foundUser.isActive && foundUser.password === user.password) {
                            auth.loginUser(foundUser);
                            return;
                        }
                    } catch (e) {
                        console.error('Error parsing stored user:', e);
                    }
                }

                // Show login screen
                document.getElementById('login-screen').style.display = 'flex';
                document.getElementById('app-container').style.display = 'none';
            },

            login: async (event) => {
                event.preventDefault();
                
                const userId = document.getElementById('login-userid').value.trim();
                const password = document.getElementById('login-password').value;
                const errorEl = document.getElementById('login-error');
                
                // Find user
                const user = state.authUsers.find(u => 
                    u.userId === userId && 
                    u.password === password && 
                    u.isActive === true
                );
                
                if (user) {
                    // Update last login
                    user.lastLogin = new Date().toISOString();
                    localStorage.setItem(DB_KEY_AUTH_USERS, JSON.stringify(state.authUsers));
                    
                    // Save current user
                    localStorage.setItem(DB_KEY_CURRENT_USER, JSON.stringify({
                        userId: user.userId,
                        password: user.password
                    }));
                    
                    auth.loginUser(user);
                    errorEl.classList.remove('show');
                } else {
                    errorEl.classList.add('show');
                }
                
                return false;
            },

            loginUser: (user) => {
                state.currentUser = user;
                
                // Hide login, show app
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('app-container').style.display = 'block';
                
                // Update UI
                document.getElementById('user-name').textContent = user.name;
                document.getElementById('user-role').textContent = user.role;
                document.getElementById('welcome-name').textContent = user.name;
                document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
                
                // Show/hide navigation based on responsibilities
                const usersNavBtn = document.getElementById('users-nav-btn');
                if (usersNavBtn) { // Check if element exists
                    if (user.responsibilities.includes(RESPONSIBILITIES.USER_MANAGEMENT) || user.role === 'Administrator') {
                        usersNavBtn.style.display = 'inline-block';
                    } else {
                        usersNavBtn.style.display = 'none';
                    }
                }
                
                // Load existing modules
                app.loadFromLocalStorage();
                
                // Render home cards based on responsibilities
                auth.renderHomeCards();
                
                // Initialize cloud sync
                setTimeout(async () => {
                    const connected = await syncManager.testConnection();
                    if (connected) {
                        await syncManager.loadFromCloud();
                    }
                }, 500);
                
                showToast(`Welcome back, ${user.name}!`, 'success');
            },

            logout: () => {
                if (confirm('Are you sure you want to logout?')) {
                    try {
                        // Clear current user from storage and state
                        localStorage.removeItem(DB_KEY_CURRENT_USER);
                        state.currentUser = null;
                        
                        // Get DOM elements
                        const loginScreen = document.getElementById('login-screen');
                        const appContainer = document.getElementById('app-container');
                        const userIdInput = document.getElementById('login-userid');
                        const passwordInput = document.getElementById('login-password');
                        const errorElement = document.getElementById('login-error');
                        
                        // Update display
                        if (loginScreen) loginScreen.style.display = 'flex';
                        if (appContainer) appContainer.style.display = 'none';
                        
                        // Clear form inputs if they exist
                        if (userIdInput) userIdInput.value = '';
                        if (passwordInput) passwordInput.value = '';
                        if (errorElement) errorElement.classList.remove('show');
                        
                        showToast('You have been logged out', 'success');
                    } catch (error) {
                        console.error('Error during logout:', error);
                        showToast('Logout failed. Please refresh the page.', 'error');
                    }
                }
            },

            renderHomeCards: () => {
                const cardsContainer = document.getElementById('home-cards');
                cardsContainer.innerHTML = '';
                
                const user = state.currentUser;
                if (!user) return;
                
                // Define all possible cards
                const allCards = [
                    {
                        id: 'tasks',
                        title: 'Task Management',
                        description: 'Manage daily tasks and reports',
                        icon: 'ðŸ“‹',
                        responsibility: RESPONSIBILITIES.TASK_MANAGEMENT,
                        onclick: () => app.navigate('tasks')
                    },
                    {
                        id: 'profile',
                        title: 'User Profile',
                        description: 'View and edit your profile',
                        icon: 'ðŸ‘¤',
                        responsibility: RESPONSIBILITIES.USER_PROFILE,
                        onclick: () => showToast('User Profile module coming soon!', 'info')
                    },
                    {
                        id: 'leave',
                        title: 'Leave Management',
                        description: 'Apply and manage leave requests',
                        icon: 'ðŸ–ï¸',
                        responsibility: RESPONSIBILITIES.LEAVE_MANAGEMENT,
                        onclick: () => showToast('Leave Management module coming soon!', 'info')
                    },
                    {
                        id: 'overtime',
                        title: 'Overtime Management',
                        description: 'Track and approve overtime',
                        icon: 'â°',
                        responsibility: RESPONSIBILITIES.OVERTIME_MANAGEMENT,
                        onclick: () => showToast('Overtime Management module coming soon!', 'info')
                    },
                    {
                        id: 'kpi',
                        title: 'KPI Dashboard',
                        description: 'View performance metrics',
                        icon: 'ðŸ“Š',
                        responsibility: RESPONSIBILITIES.KPI,
                        onclick: () => showToast('KPI Dashboard module coming soon!', 'info')
                    },
                    {
                        id: 'users',
                        title: 'User Management',
                        description: 'Manage system users and permissions',
                        icon: 'ðŸ‘¥',
                        responsibility: RESPONSIBILITIES.USER_MANAGEMENT,
                        onclick: () => app.navigate('users')
                    }
                ];
                
                // Filter cards based on user responsibilities
                let filteredCards = [];
                if (user.role === 'Administrator') {
                    filteredCards = allCards;
                } else {
                    filteredCards = allCards.filter(card => 
                        user.responsibilities.includes(card.responsibility)
                    );
                }
                
                // Render cards
                filteredCards.forEach(card => {
                    const cardEl = document.createElement('div');
                    cardEl.className = 'home-card';
                    cardEl.onclick = card.onclick;
                    
                    cardEl.innerHTML = `
                        <div class="card-icon">${card.icon}</div>
                        <div class="card-title">${card.title}</div>
                        <div class="card-desc">${card.description}</div>
                    `;
                    
                    cardsContainer.appendChild(cardEl);
                });
                
                // If no cards, show message
                if (filteredCards.length === 0) {
                    cardsContainer.innerHTML = `
                        <div style="text-align: center; padding: 3rem; color: var(--secondary);">
                            <h3>No responsibilities assigned</h3>
                            <p>Contact your administrator to get access to system modules.</p>
                        </div>
                    `;
                }
            }
        };

        // ========================
        // USER MANAGEMENT MODULE
        // ========================
        const userManagement = {
            openCreateModal: function() {
                // Check permission
                if (!state.currentUser || 
                   (!state.currentUser.responsibilities.includes(RESPONSIBILITIES.USER_MANAGEMENT) && 
                    state.currentUser.role !== 'Administrator')) {
                    showToast('You do not have permission to create users', 'error');
                    return;
                }
                
                // Reset form
                document.getElementById('new-user-id').value = '';
                document.getElementById('new-user-name').value = '';
                document.getElementById('new-user-designation').value = '';
                document.getElementById('new-user-department').value = '';
                document.getElementById('new-user-phone').value = '';
                document.getElementById('new-user-email').value = '';
                document.getElementById('new-user-role').value = '';
                document.getElementById('new-user-password').value = '';
                document.getElementById('new-user-active').checked = true;
                
                // Render responsibilities grid
                this.renderResponsibilitiesGrid([]);
                
                // Show modal
                document.getElementById('create-user-modal').classList.add('open');
            },

            closeCreateModal: function() {
                document.getElementById('create-user-modal').classList.remove('open');
            },

            onRoleChange: function() {
                const role = document.getElementById('new-user-role').value;
                let defaultResponsibilities = [];
                
                switch(role) {
                    case 'Administrator':
                        defaultResponsibilities = ALL_RESPONSIBILITIES;
                        break;
                    case 'Manager':
                    case 'GM':
                        defaultResponsibilities = [
                            RESPONSIBILITIES.TASK_MANAGEMENT,
                            RESPONSIBILITIES.LEAVE_MANAGEMENT,
                            RESPONSIBILITIES.OVERTIME_MANAGEMENT,
                            RESPONSIBILITIES.KPI
                        ];
                        break;
                    case 'Shift Officer':
                        defaultResponsibilities = [
                            RESPONSIBILITIES.TASK_MANAGEMENT,
                            RESPONSIBILITIES.USER_PROFILE
                        ];
                        break;
                    case 'Worker':
                        defaultResponsibilities = [
                            RESPONSIBILITIES.TASK_MANAGEMENT,
                            RESPONSIBILITIES.USER_PROFILE
                        ];
                        break;
                }
                
                this.renderResponsibilitiesGrid(defaultResponsibilities);
            },

            renderResponsibilitiesGrid: function(selectedResponsibilities) {
                const grid = document.getElementById('responsibilities-grid');
                grid.innerHTML = '';
                
                ALL_RESPONSIBILITIES.forEach(resp => {
                    const isSelected = selectedResponsibilities.includes(resp);
                    const item = document.createElement('div');
                    item.className = `responsibility-item ${isSelected ? 'selected' : ''}`;
                    
                    item.innerHTML = `
                        <input type="checkbox" id="resp-${resp.replace(/\s+/g, '-')}" 
                               ${isSelected ? 'checked' : ''}>
                        <label for="resp-${resp.replace(/\s+/g, '-')}">${resp}</label>
                    `;
                    
                    item.onclick = (e) => {
                        if (e.target.type !== 'checkbox') {
                            const checkbox = item.querySelector('input[type="checkbox"]');
                            checkbox.checked = !checkbox.checked;
                            item.classList.toggle('selected', checkbox.checked);
                        }
                    };
                    
                    grid.appendChild(item);
                });
            },

            getSelectedResponsibilities: function() {
                const selected = [];
                ALL_RESPONSIBILITIES.forEach(resp => {
                    const checkbox = document.getElementById(`resp-${resp.replace(/\s+/g, '-')}`);
                    if (checkbox && checkbox.checked) {
                        selected.push(resp);
                    }
                });
                return selected;
            },

            createUser: function() {
                // Validate required fields
                const userId = document.getElementById('new-user-id').value.trim();
                const name = document.getElementById('new-user-name').value.trim();
                const designation = document.getElementById('new-user-designation').value.trim();
                const department = document.getElementById('new-user-department').value;
                const role = document.getElementById('new-user-role').value;
                const password = document.getElementById('new-user-password').value;
                
                if (!userId || !name || !designation || !department || !role || !password) {
                    showToast('Please fill all required fields (*)', 'error');
                    return;
                }
                
                // Check if user ID already exists
                if (state.authUsers.some(u => u.userId === userId)) {
                    showToast('User ID already exists', 'error');
                    return;
                }
                
                // Get selected responsibilities
                const responsibilities = this.getSelectedResponsibilities();
                
                // Create new user
                const newUser = {
                    userId: userId,
                    name: name,
                    designation: designation,
                    department: department,
                    phone: document.getElementById('new-user-phone').value.trim(),
                    email: document.getElementById('new-user-email').value.trim(),
                    role: role,
                    responsibilities: responsibilities,
                    password: password,
                    isActive: document.getElementById('new-user-active').checked,
                    createdAt: new Date().toISOString(),
                    lastLogin: null
                };
                
                // Add to auth users
                state.authUsers.push(newUser);
                localStorage.setItem(DB_KEY_AUTH_USERS, JSON.stringify(state.authUsers));
                
                // Also add to task users list if not exists
                if (!state.users.includes(name)) {
                    state.users.push(name);
                    localStorage.setItem(DB_KEY_USERS, JSON.stringify(state.users));
                }
                
                // Save to cloud if connected
                if (state.cloudConnected) {
                    syncManager.saveToCloud();
                }
                
                // Close modal and refresh user list
                this.closeCreateModal();
                this.renderUserTable();
                
                showToast(`User ${name} created successfully!`, 'success');
            },

            renderUserTable: function() {
                const tbody = document.getElementById('user-table-body');
                if (!tbody) return;
                
                tbody.innerHTML = '';
                
                // Sort users: current user first, then by name
                const sortedUsers = [...state.authUsers].sort((a, b) => {
                    if (a.userId === state.currentUser.userId) return -1;
                    if (b.userId === state.currentUser.userId) return 1;
                    return a.name.localeCompare(b.name);
                });
                
                sortedUsers.forEach(user => {
                    const tr = document.createElement('tr');
                    
                    // Action buttons based on permissions
                    let actions = '';
                    if (state.currentUser.role === 'Administrator' || 
                       (state.currentUser.responsibilities.includes(RESPONSIBILITIES.USER_MANAGEMENT) && 
                        user.userId !== state.currentUser.userId)) {
                        actions = `
                            <div class="user-actions">
                                <button class="btn btn-sm btn-primary" 
                                        onclick="userManagement.openEditModal('${user.userId}')">
                                    Edit
                                </button>
                                <button class="btn btn-sm ${user.isActive ? 'btn-warning' : 'btn-success'}" 
                                        onclick="userManagement.toggleUserStatus('${user.userId}')">
                                    ${user.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                                <button class="btn btn-sm btn-danger" 
                                        onclick="userManagement.deleteUser('${user.userId}')"
                                        ${user.userId === 'admin' ? 'disabled' : ''}>
                                    Delete
                                </button>
                            </div>`;
                    } else {
                        actions = '<span style="color: var(--secondary);">No actions</span>';
                    }
                    
                    tr.innerHTML = `
                        <td><strong>${user.userId}</strong></td>
                        <td>${user.name}</td>
                        <td>${user.designation}</td>
                        <td>${user.department}</td>
                        <td>${user.role}</td>
                        <td>
                            <span class="status-badge ${user.isActive ? 'status-active' : 'status-inactive'}">
                                ${user.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>${actions}</td>
                    `;
                    
                    tbody.appendChild(tr);
                });
            },

            toggleUserStatus: function(userId) {
                if (userId === state.currentUser.userId) {
                    showToast('You cannot change your own status', 'error');
                    return;
                }
                
                const user = state.authUsers.find(u => u.userId === userId);
                if (user) {
                    user.isActive = !user.isActive;
                    localStorage.setItem(DB_KEY_AUTH_USERS, JSON.stringify(state.authUsers));
                    this.renderUserTable();
                    
                    showToast(`User ${user.name} ${user.isActive ? 'activated' : 'deactivated'}`, 'success');
                }
            },

            deleteUser: function(userId) {
                if (userId === 'admin') {
                    showToast('Cannot delete system administrator', 'error');
                    return;
                }
                
                if (userId === state.currentUser.userId) {
                    showToast('You cannot delete yourself', 'error');
                    return;
                }
                
                if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                    const index = state.authUsers.findIndex(u => u.userId === userId);
                    if (index !== -1) {
                        const userName = state.authUsers[index].name;
                        state.authUsers.splice(index, 1);
                        localStorage.setItem(DB_KEY_AUTH_USERS, JSON.stringify(state.authUsers));
                        this.renderUserTable();
                        
                        showToast(`User ${userName} deleted successfully`, 'success');
                    }
                }
            },

            changePassword: function() {
                document.getElementById('current-password').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-password').value = '';
                document.getElementById('change-password-modal').classList.add('open');
            },

            closePasswordModal: function() {
                document.getElementById('change-password-modal').classList.remove('open');
            },

            updatePassword: function() {
                const current = document.getElementById('current-password').value;
                const newPass = document.getElementById('new-password').value;
                const confirmPass = document.getElementById('confirm-password').value;
                
                if (!current || !newPass || !confirmPass) {
                    showToast('Please fill all fields', 'error');
                    return;
                }
                
                if (newPass !== confirmPass) {
                    showToast('New passwords do not match', 'error');
                    return;
                }
                
                if (state.currentUser.password !== current) {
                    showToast('Current password is incorrect', 'error');
                    return;
                }
                
                // Update password
                state.currentUser.password = newPass;
                const userIndex = state.authUsers.findIndex(u => u.userId === state.currentUser.userId);
                if (userIndex !== -1) {
                    state.authUsers[userIndex].password = newPass;
                    localStorage.setItem(DB_KEY_AUTH_USERS, JSON.stringify(state.authUsers));
                    
                    // Update stored current user
                    localStorage.setItem(DB_KEY_CURRENT_USER, JSON.stringify({
                        userId: state.currentUser.userId,
                        password: newPass
                    }));
                }
                
                this.closePasswordModal();
                showToast('Password changed successfully!', 'success');
            },

            openEditModal: function(userId) {
                // Check permission
                if (!state.currentUser || 
                   (!state.currentUser.responsibilities.includes(RESPONSIBILITIES.USER_MANAGEMENT) && 
                    state.currentUser.role !== 'Administrator')) {
                    showToast('You do not have permission to edit users', 'error');
                    return;
                }
                
                const user = state.authUsers.find(u => u.userId === userId);
                if (!user) {
                    showToast('User not found', 'error');
                    return;
                }
                
                // Populate form with user data
                document.getElementById('edit-user-id').value = user.userId;
                document.getElementById('edit-user-name').value = user.name;
                document.getElementById('edit-user-designation').value = user.designation;
                document.getElementById('edit-user-department').value = user.department;
                document.getElementById('edit-user-phone').value = user.phone || '';
                document.getElementById('edit-user-email').value = user.email || '';
                document.getElementById('edit-user-role').value = user.role;
                document.getElementById('edit-user-active').checked = user.isActive;
                
                // Render responsibilities grid
                this.renderEditResponsibilitiesGrid(user.responsibilities);
                
                // Show modal
                document.getElementById('edit-user-modal').classList.add('open');
            },

            closeEditModal: function() {
                document.getElementById('edit-user-modal').classList.remove('open');
            },

            renderEditResponsibilitiesGrid: function(selectedResponsibilities) {
                const grid = document.getElementById('edit-responsibilities-grid');
                grid.innerHTML = '';
                
                ALL_RESPONSIBILITIES.forEach(resp => {
                    const isSelected = selectedResponsibilities.includes(resp);
                    const item = document.createElement('div');
                    item.className = `responsibility-item ${isSelected ? 'selected' : ''}`;
                    
                    item.innerHTML = `
                        <input type="checkbox" id="edit-resp-${resp.replace(/\s+/g, '-')}" 
                               ${isSelected ? 'checked' : ''}>
                        <label for="edit-resp-${resp.replace(/\s+/g, '-')}" class="edit-resp-label">${resp}</label>
                    `;
                    
                    item.onclick = (e) => {
                        if (e.target.type !== 'checkbox') {
                            const checkbox = item.querySelector('input[type="checkbox"]');
                            checkbox.checked = !checkbox.checked;
                            item.classList.toggle('selected', checkbox.checked);
                        }
                    };
                    
                    grid.appendChild(item);
                });
            },

            getSelectedEditResponsibilities: function() {
                const selected = [];
                ALL_RESPONSIBILITIES.forEach(resp => {
                    const checkbox = document.getElementById(`edit-resp-${resp.replace(/\s+/g, '-')}`);
                    if (checkbox && checkbox.checked) {
                        selected.push(resp);
                    }
                });
                return selected;
            },

            onEditRoleChange: function() {
                const role = document.getElementById('edit-user-role').value;
                let defaultResponsibilities = [];
                
                switch(role) {
                    case 'Administrator':
                        defaultResponsibilities = ALL_RESPONSIBILITIES;
                        break;
                    case 'Manager':
                    case 'GM':
                        defaultResponsibilities = [
                            RESPONSIBILITIES.TASK_MANAGEMENT,
                            RESPONSIBILITIES.LEAVE_MANAGEMENT,
                            RESPONSIBILITIES.OVERTIME_MANAGEMENT,
                            RESPONSIBILITIES.KPI
                        ];
                        break;
                    case 'Shift Officer':
                        defaultResponsibilities = [
                            RESPONSIBILITIES.TASK_MANAGEMENT,
                            RESPONSIBILITIES.USER_PROFILE
                        ];
                        break;
                    case 'Worker':
                        defaultResponsibilities = [
                            RESPONSIBILITIES.TASK_MANAGEMENT,
                            RESPONSIBILITIES.USER_PROFILE
                        ];
                        break;
                }
                
                this.renderEditResponsibilitiesGrid(defaultResponsibilities);
            },

            updateUser: function() {
                // Validate required fields
                const userId = document.getElementById('edit-user-id').value.trim();
                const name = document.getElementById('edit-user-name').value.trim();
                const designation = document.getElementById('edit-user-designation').value.trim();
                const department = document.getElementById('edit-user-department').value;
                const role = document.getElementById('edit-user-role').value;
                
                if (!userId || !name || !designation || !department || !role) {
                    showToast('Please fill all required fields (*)', 'error');
                    return;
                }
                
                // Get selected responsibilities
                const responsibilities = this.getSelectedEditResponsibilities();
                
                // Find user to update
                const userIndex = state.authUsers.findIndex(u => u.userId === userId);
                if (userIndex === -1) {
                    showToast('User not found', 'error');
                    return;
                }
                
                // Update user
                const user = state.authUsers[userIndex];
                const oldName = user.name; // Store old name to check if it changed
                
                user.name = name;
                user.designation = designation;
                user.department = department;
                user.phone = document.getElementById('edit-user-phone').value.trim();
                user.email = document.getElementById('edit-user-email').value.trim();
                user.role = role;
                user.responsibilities = responsibilities;
                user.isActive = document.getElementById('edit-user-active').checked;
                
                // Update in localStorage
                localStorage.setItem(DB_KEY_AUTH_USERS, JSON.stringify(state.authUsers));
                
                // If name changed, update in users list as well
                if (oldName !== name) {
                    const userInListIndex = state.users.indexOf(oldName);
                    if (userInListIndex !== -1) {
                        state.users[userInListIndex] = name;
                        localStorage.setItem(DB_KEY_USERS, JSON.stringify(state.users));
                    }
                }
                
                // Save to cloud if connected
                if (state.cloudConnected) {
                    syncManager.saveToCloud();
                }
                
                // Close modal and refresh user list
                this.closeEditModal();
                this.renderUserTable();
                
                showToast(`User ${name} updated successfully!`, 'success');
            }
        };

        // ========================
        // UTILITY FUNCTIONS
        // ========================
        const generateId = () => '_' + Math.random().toString(36).substr(2, 9);
        
        const showToast = (msg, type = 'success') => {
            const area = document.getElementById('toast-area');
            if (!area) return;
            
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.style.borderLeft = `4px solid ${type === 'success' ? 'var(--success)' : type === 'warning' ? 'var(--warning)' : 'var(--danger)'}`;
            toast.innerText = msg;
            area.appendChild(toast);
            setTimeout(() => { 
                toast.style.opacity = '0'; 
                setTimeout(() => toast.remove(), 300); 
            }, 3000);
        };
        
        const debugLog = (message, data = null) => {
            const debugPanel = document.getElementById('debug-panel');
            if (!debugPanel) return;
            
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.innerHTML = `<strong>${timestamp}:</strong> ${message}`;
            if (data) {
                logEntry.innerHTML += `<pre style="margin: 5px 0; font-size: 10px; overflow: auto;">${JSON.stringify(data, null, 2)}</pre>`;
            }
            debugPanel.appendChild(logEntry);
            debugPanel.scrollTop = debugPanel.scrollHeight;
            console.log(`[${timestamp}] ${message}`, data || '');
        };
        
        const toggleDebug = () => {
            const panel = document.getElementById('debug-panel');
            if (panel) {
                panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
            }
        };
        
        const updateCloudStatus = (status) => {
            const indicator = document.getElementById('cloud-status-indicator');
            const text = document.getElementById('cloud-status-text');
            
            if (!indicator || !text) return;
            
            switch(status) {
                case 'online':
                    indicator.className = 'cloud-indicator online';
                    text.textContent = 'Connected to cloud';
                    state.cloudConnected = true;
                    break;
                case 'offline':
                    indicator.className = 'cloud-indicator offline';
                    text.textContent = 'Offline - using local storage';
                    state.cloudConnected = false;
                    break;
                case 'syncing':
                    indicator.className = 'cloud-indicator syncing';
                    text.textContent = 'Syncing with cloud...';
                    state.cloudSyncing = true;
                    break;
                case 'error':
                    indicator.className = 'cloud-indicator offline';
                    text.textContent = 'Cloud sync error';
                    state.cloudConnected = false;
                    break;
            }
            state.cloudSyncing = status === 'syncing';
        };

        // ========================
        // SYNC MANAGER
        // ========================
        const syncManager = {
            // Test connection to Supabase
            testConnection: async () => {
                try {
                    updateCloudStatus('syncing');
                    debugLog('Testing Supabase connection...');
                    
                    if (!window.supabase || !supabase) {
                        throw new Error('Supabase client not loaded');
                    }
                    
                    debugLog('Supabase client loaded, testing connection...');
                    
                    const { data, error } = await supabase
                        .from('task_manager_data')
                        .select('id')
                        .limit(1);
                    
                    if (error) {
                        if (error.message.includes('relation') || error.message.includes('does not exist')) {
                            debugLog('Table does not exist, will create on first save');
                            updateCloudStatus('online');
                            return true;
                        }
                        throw error;
                    }
                    
                    debugLog('Supabase connection successful', data);
                    updateCloudStatus('online');
                    return true;
                } catch (error) {
                    console.error('Supabase connection failed:', error);
                    debugLog('Connection failed:', error.message);
                    updateCloudStatus('offline');
                    
                    let errorMsg = 'Connection failed';
                    if (error.message.includes('Failed to fetch')) {
                        errorMsg = 'Network error - check internet connection';
                    } else if (error.message.includes('JWT')) {
                        errorMsg = 'Authentication error - check Supabase credentials';
                    } else if (error.message.includes('relation')) {
                        errorMsg = 'Table not found - will create on first save';
                    }
                    
                    showToast(errorMsg, 'error');
                    return false;
                }
            },
            
            // Save data to Supabase
            saveToCloud: async () => {
                try {
                    if (!navigator.onLine) {
                        showToast('No internet connection', 'error');
                        return null;
                    }
                    
                    updateCloudStatus('syncing');
                    debugLog('Saving data to cloud...');
                    
                    // Prepare data with auth users
                    const cloudData = {
                        tasks: state.tasks,
                        logs: state.logs,
                        users: state.users,
                        auth_users: state.authUsers,
                        last_updated: new Date().toISOString(),
                        device_id: navigator.userAgent.substring(0, 100)
                    };
                    
                    let result;
                    
                    if (state.cloudId) {
                        debugLog('Updating existing record:', state.cloudId);
                        const { data, error } = await supabase
                            .from('task_manager_data')
                            .update(cloudData)
                            .eq('id', state.cloudId)
                            .select();
                        
                        if (error) {
                            // If record doesn't exist, create new one
                            if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
                                debugLog('Record not found, creating new one');
                                state.cloudId = null;
                                localStorage.removeItem(DB_KEY_CLOUD_ID);
                                
                                // Create new record
                                const { data: newData, error: newError } = await supabase
                                    .from('task_manager_data')
                                    .insert([cloudData])
                                    .select();
                                
                                if (newError) throw newError;
                                result = newData[0];
                                state.cloudId = result.id;
                                localStorage.setItem(DB_KEY_CLOUD_ID, result.id);
                            } else {
                                throw error;
                            }
                        } else {
                            result = data && data.length > 0 ? data[0] : cloudData;
                        }
                    } else {
                        debugLog('Creating new record');
                        const { data, error } = await supabase
                            .from('task_manager_data')
                            .insert([cloudData])
                            .select();
                        
                        if (error) throw error;
                        result = data[0];
                        state.cloudId = result.id;
                        localStorage.setItem(DB_KEY_CLOUD_ID, result.id);
                    }
                    
                    state.lastSync = new Date().toISOString();
                    localStorage.setItem(DB_KEY_LAST_SYNC, state.lastSync);
                    
                    updateCloudStatus('online');
                    showToast('Data saved to cloud successfully!');
                    debugLog('Save successful:', { id: state.cloudId, last_updated: state.lastSync });
                    return result;
                } catch (error) {
                    console.error('Error saving to cloud:', error);
                    debugLog('Save failed:', error);
                    updateCloudStatus('error');
                    showToast('Failed to save to cloud: ' + error.message, 'error');
                    return null;
                }
            },
            
            // Load data from Supabase
            loadFromCloud: async () => {
                try {
                    if (!navigator.onLine) {
                        showToast('No internet connection', 'error');
                        return null;
                    }
                    
                    updateCloudStatus('syncing');
                    debugLog('Loading data from cloud...');
                    
                    let data = null;
                    
                    if (state.cloudId) {
                        debugLog('Loading specific record:', state.cloudId);
                        const { data: recordData, error } = await supabase
                            .from('task_manager_data')
                            .select('*')
                            .eq('id', state.cloudId)
                            .maybeSingle();
                        
                        if (error) {
                            // If record doesn't exist, try to get latest
                            if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
                                debugLog('Specific record not found, loading latest');
                                state.cloudId = null;
                                localStorage.removeItem(DB_KEY_CLOUD_ID);
                                
                                // Try to get latest record
                                const { data: latestData, error: latestError } = await supabase
                                    .from('task_manager_data')
                                    .select('*')
                                    .order('last_updated', { ascending: false })
                                    .limit(1);
                                
                                if (latestError) throw latestError;
                                data = latestData;
                            } else {
                                throw error;
                            }
                        } else {
                            data = recordData ? [recordData] : null;
                        }
                    } else {
                        debugLog('Loading most recent record');
                        const { data: latestData, error } = await supabase
                            .from('task_manager_data')
                            .select('*')
                            .order('last_updated', { ascending: false })
                            .limit(1);
                        
                        if (error) throw error;
                        data = latestData;
                    }
                    
                    if (data && data.length > 0) {
                        const cloudData = data[0];
                        debugLog('Data loaded from cloud:', cloudData);
                        
                        // Update local state
                        state.tasks = cloudData.tasks || {};
                        state.logs = cloudData.logs || [];
                        state.users = cloudData.users || ["Operator 1", "Manager", "Supervisor"];
                        state.authUsers = cloudData.auth_users || state.authUsers;
                        state.cloudId = cloudData.id;
                        state.lastSync = cloudData.last_updated;
                        
                        // Save to localStorage
                        localStorage.setItem(DB_KEY_TASKS, JSON.stringify(state.tasks));
                        localStorage.setItem(DB_KEY_LOGS, JSON.stringify(state.logs));
                        localStorage.setItem(DB_KEY_USERS, JSON.stringify(state.users));
                        localStorage.setItem(DB_KEY_AUTH_USERS, JSON.stringify(state.authUsers));
                        localStorage.setItem(DB_KEY_CLOUD_ID, state.cloudId);
                        localStorage.setItem(DB_KEY_LAST_SYNC, state.lastSync);
                        
                        updateCloudStatus('online');
                        showToast('Data loaded from cloud successfully!');
                        return cloudData;
                    } else {
                        debugLog('No cloud data found');
                        showToast('No cloud data found', 'warning');
                        updateCloudStatus('online');
                        return null;
                    }
                } catch (error) {
                    console.error('Error loading from cloud:', error);
                    debugLog('Load failed:', error);
                    updateCloudStatus('error');
                    showToast('Failed to load from cloud: ' + error.message, 'error');
                    return null;
                }
            },
            
            forceSync: async () => {
                debugLog('Force sync started');
                await syncManager.saveToCloud();
                await syncManager.loadFromCloud();
                
                // Refresh UI if on tasks page
                if (document.getElementById('section-tasks')?.classList.contains('active')) {
                    app.renderUserDropdown();
                    app.renderTasks();
                    home.renderUserDropdown();
                }
            },
            
            clearLocalData: () => {
                if (confirm('Clear all local data? This will not affect cloud data.')) {
                    localStorage.removeItem(DB_KEY_TASKS);
                    localStorage.removeItem(DB_KEY_LOGS);
                    localStorage.removeItem(DB_KEY_USERS);
                    
                    state.tasks = {};
                    state.logs = [];
                    state.currentChecks.clear();
                    
                    app.seedDefaults();
                    
                    // Refresh UI if on tasks page
                    if (document.getElementById('section-tasks')?.classList.contains('active')) {
                        app.renderUserDropdown();
                        app.renderTasks();
                    }
                    
                    showToast('Local data cleared');
                }
            },
            
            clearCloudId: () => {
                state.cloudId = null;
                state.lastSync = null;
                localStorage.removeItem(DB_KEY_CLOUD_ID);
                localStorage.removeItem(DB_KEY_LAST_SYNC);
                showToast('Cloud ID cleared. Next sync will create new record.', 'info');
            },
            
            openModal: () => {
                const modal = document.getElementById('sync-modal');
                const statusUI = document.getElementById('sync-status-ui');
                
                if (!modal || !statusUI) return;
                
                statusUI.innerHTML = `
                    <div style="margin-bottom: 1rem;">
                        <h4>Cloud Sync Status</h4>
                        <p><strong>Connection:</strong> ${state.cloudConnected ? 'âœ… Online' : 'âŒ Offline'}</p>
                        <p><strong>Cloud ID:</strong> ${state.cloudId || 'Not set'}</p>
                        <p><strong>Last Sync:</strong> ${state.lastSync ? new Date(state.lastSync).toLocaleString() : 'Never'}</p>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <h4>Local Storage</h4>
                        <p><strong>Tasks:</strong> ${Object.keys(state.tasks).length} shifts</p>
                        <p><strong>Logs:</strong> ${state.logs.length} records</p>
                        <p><strong>Users:</strong> ${state.users.length} users</p>
                        <p><strong>Auth Users:</strong> ${state.authUsers.length} accounts</p>
                    </div>
                    <div class="button-group">
                        <button class="btn btn-success" onclick="syncManager.forceSync()">Force Sync</button>
                        <button class="btn btn-warning" onclick="syncManager.saveToCloud()">Save to Cloud</button>
                        <button class="btn btn-primary" onclick="syncManager.loadFromCloud()">Load from Cloud</button>
                        <button class="btn btn-secondary" onclick="syncManager.clearCloudId()">Clear Cloud ID</button>
                    </div>
                `;
                
                modal.classList.add('open');
            },
            
            closeModal: () => {
                const modal = document.getElementById('sync-modal');
                if (modal) modal.classList.remove('open');
            }
        };

        // ========================
        // LOCAL STORAGE MANAGEMENT
        // ========================
        const saveState = async (autoSync = true) => {
            // Save to localStorage
            localStorage.setItem(DB_KEY_TASKS, JSON.stringify(state.tasks));
            localStorage.setItem(DB_KEY_LOGS, JSON.stringify(state.logs));
            localStorage.setItem(DB_KEY_USERS, JSON.stringify(state.users));
            
            // Auto-sync to cloud if enabled and connected
            if (autoSync && state.cloudConnected && !state.cloudSyncing && navigator.onLine) {
                try {
                    await syncManager.saveToCloud();
                } catch (error) {
                    debugLog('Auto-sync failed, data saved locally');
                }
            }
        };

        // ========================
        // MAIN APPLICATION LOGIC
        // ========================
        const app = {
            init: async () => {
                debugLog('Application initializing...');
                
                // Initialize authentication first
                auth.init();
            },
            
            loadFromLocalStorage: () => {
                debugLog('Loading from local storage...');
                
                if(localStorage.getItem(DB_KEY_TASKS)) {
                    state.tasks = JSON.parse(localStorage.getItem(DB_KEY_TASKS));
                    debugLog('Tasks loaded from local storage:', Object.keys(state.tasks).length + ' shifts');
                } else {
                    debugLog('No tasks in local storage, seeding defaults');
                    app.seedDefaults();
                }

                if(localStorage.getItem(DB_KEY_LOGS)) {
                    state.logs = JSON.parse(localStorage.getItem(DB_KEY_LOGS));
                    debugLog('Logs loaded from local storage:', state.logs.length + ' records');
                }

                if(localStorage.getItem(DB_KEY_USERS)) {
                    state.users = JSON.parse(localStorage.getItem(DB_KEY_USERS));
                    debugLog('Users loaded from local storage:', state.users.length + ' users');
                } else {
                    state.users = ["Operator 1", "Manager", "Supervisor"];
                    saveState(false);
                }
            },

            seedDefaults: () => {
                debugLog('Seeding default tasks');
                ['A', 'B', 'C', 'G'].forEach(shift => {
                    state.tasks[shift] = [
                        {id: generateId(), text: 'Check Machine Status', active: true},
                        {id: generateId(), text: 'Clean Work Area', active: true},
                        {id: generateId(), text: 'Log Production Data', active: true}
                    ];
                });
                saveState(false);
            },

            renderUserDropdown: () => {
                const select = document.getElementById('user-select');
                if (!select) return;
                
                select.innerHTML = '<option value="" disabled selected>Select User...</option>';
                state.users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u;
                    opt.innerText = u;
                    select.appendChild(opt);
                });
            },

            renderDashboard: () => {
                // Populate user filter dropdown for dashboard
                const dashUserSelect = document.getElementById('dash-user-select');
                if (dashUserSelect) {
                    dashUserSelect.innerHTML = '<option value="">All Users</option>';
                    state.users.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user;
                        option.textContent = user;
                        dashUserSelect.appendChild(option);
                    });
                }

                // Initialize dashboard date values
                const today = new Date().toISOString().split('T')[0];
                const rangeStart = document.getElementById('range-start');
                const rangeEnd = document.getElementById('range-end');
                if (rangeStart) rangeStart.value = today;
                if (rangeEnd) rangeEnd.value = today;

                // Render dashboard stats if needed
                // This would update the stat totals, averages, charts, and logs table
                // Implementation would depend on your specific dashboard logic
                debugLog('Dashboard rendered');
            },

            navigate: (view) => {
                // Hide all sections
                document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
                // Show selected section
                const section = document.getElementById(`section-${view}`);
                if (section) section.classList.add('active');
                
                // Update navigation buttons
                document.querySelectorAll('.nav-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.innerText.toLowerCase().includes(view.toLowerCase()));
                });

                if(view === 'home') {
                    // Render home cards
                    auth.renderHomeCards();
                } else if(view === 'dashboard') {
                    // Render dashboard
                    app.renderDashboard();
                } else if(view === 'users') {
                    // Check if user has permission to access user management
                    if (!state.currentUser || 
                        (!state.currentUser.responsibilities.includes(RESPONSIBILITIES.USER_MANAGEMENT) && 
                         state.currentUser.role !== 'Administrator')) {
                        // User doesn't have permission, show error and redirect to home
                        showToast('You do not have permission to access User Management', 'error');
                        app.navigate('home');
                        return;
                    }
                    // Render user table
                    userManagement.renderUserTable();
                } else if(view === 'tasks') {
                    // Set up UI
                    const today = new Date().toISOString().split('T')[0];
                    const dateInput = document.getElementById('report-date');
                    if (dateInput) dateInput.value = today;
                    
                    // Render tasks and dropdowns
                    app.renderUserDropdown();
                    app.renderTasks();
                    home.renderUserDropdown();
                }
            },

            setShift: (shift) => {
                state.currentShift = shift;
                state.currentChecks.clear();
                
                document.querySelectorAll('.shift-tab').forEach(btn => {
                    btn.classList.toggle('active', btn.innerText.includes(shift));
                });
                app.renderTasks();
            },

            renderTasks: () => {
                const listEl = document.getElementById('task-list-ui');
                if (!listEl) return;
                
                listEl.innerHTML = '';
                
                const userSelect = document.getElementById('user-select');
                const dateInput = document.getElementById('report-date');
                
                const user = userSelect ? userSelect.value : '';
                const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
                const shift = state.currentShift;
                const tasks = state.tasks[shift] || [];
                let activeCount = 0;

                let previousLog = null;
                if (user && date) {
                    const matchingLogs = state.logs.filter(l => 
                        l.user === user && 
                        l.reportDate === date && 
                        l.shift === shift
                    );
                    
                    if (matchingLogs.length > 0) {
                        matchingLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                        previousLog = matchingLogs[0];
                    }
                }

                state.currentChecks.clear();
                if (previousLog && previousLog.checkedTaskIds) {
                    previousLog.checkedTaskIds.forEach(id => state.currentChecks.add(id));
                }

                tasks.forEach(t => {
                    if(!t.active) return;
                    activeCount++;
                    const isChecked = state.currentChecks.has(t.id);
                    
                    const li = document.createElement('li');
                    li.className = `task-item ${isChecked ? 'checked' : 'unchecked'}`;
                    
                    li.innerHTML = `
                        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="app.toggleCheck('${t.id}', this)">
                        <span class="task-text">${t.text}</span>
                    `;
                    listEl.appendChild(li);
                });

                if(activeCount === 0) listEl.innerHTML = '<div style="padding:1rem; color:var(--secondary);">No active tasks.</div>';
                app.updateProgress(activeCount);
            },

            toggleCheck: (id, box) => {
                const li = box.closest('.task-item');
                if(box.checked) { 
                    state.currentChecks.add(id); 
                    if(li) {
                        li.classList.remove('unchecked');
                        li.classList.add('checked'); 
                    }
                } else { 
                    state.currentChecks.delete(id); 
                    if(li) {
                        li.classList.remove('checked');
                        li.classList.add('unchecked'); 
                    }
                }
                
                const totalActive = state.tasks[state.currentShift].filter(t => t.active).length;
                app.updateProgress(totalActive);
                
                saveState(true);
            },

            updateProgress: (total) => {
                const pct = total === 0 ? 0 : Math.round((state.currentChecks.size / total) * 100);
                const progressBar = document.getElementById('progress-bar');
                const progressText = document.getElementById('progress-text');
                
                if (progressBar) progressBar.style.width = `${pct}%`;
                if (progressText) progressText.innerText = `${pct}%`;
            },

            submitTasks: async () => {
                const userSelect = document.getElementById('user-select');
                const dateInput = document.getElementById('report-date');
                
                const user = userSelect ? userSelect.value : '';
                const date = dateInput ? dateInput.value : '';
                
                if(!user) { showToast('Please select a user', 'error'); return; }
                if(!date) { showToast('Please select a date', 'error'); return; }

                const tasks = state.tasks[state.currentShift].filter(t => t.active);
                if(tasks.length === 0) { showToast('No active tasks to submit', 'error'); return; }

                const record = {
                    id: generateId(),
                    timestamp: new Date().toISOString(),
                    reportDate: date, 
                    shift: state.currentShift,
                    user: user,
                    total: tasks.length,
                    completed: state.currentChecks.size,
                    percentage: Math.round((state.currentChecks.size / tasks.length) * 100),
                    checkedTaskIds: Array.from(state.currentChecks)
                };

                state.logs.unshift(record);
                await saveState(true);
                showToast(`Report for ${date} submitted!`);
                
                state.currentChecks.clear();
                app.renderTasks();
            },
            
            toggleMobileMenu: () => {
                const mobileNav = document.getElementById('mobile-nav');
                mobileNav.classList.toggle('active');
            }
        };

        // ========================
        // EDITOR LOGIC
        // ========================
        const editor = {
            openModal: () => {
                const modal = document.getElementById('editor-modal');
                const shiftLabel = document.getElementById('editor-shift-label');
                
                if (modal) modal.classList.add('open');
                if (shiftLabel) shiftLabel.innerText = 'Shift ' + state.currentShift;
                editor.renderList();
            },
            closeModal: () => {
                const modal = document.getElementById('editor-modal');
                if (modal) modal.classList.remove('open');
                app.renderTasks();
            },
            renderList: () => {
                const list = document.getElementById('editor-list-ui');
                if (!list) return;
                
                list.innerHTML = '';
                state.tasks[state.currentShift].forEach((t, idx) => {
                    const div = document.createElement('div');
                    div.className = 'user-list-item';
                    div.innerHTML = `
                        <span contenteditable="true" style="flex:1; padding:4px;" onblur="editor.updateText('${t.id}', this)">${t.text}</span>
                        <button class="btn ${t.active ? 'btn-secondary' : 'btn-danger'} btn-sm" onclick="editor.toggleActive('${t.id}')">${t.active ? 'Active' : 'Inactive'}</button>
                        <button class="btn btn-danger btn-sm" onclick="editor.delete('${t.id}')">Del</button>
                    `;
                    list.appendChild(div);
                });
            },
            addTask: () => {
                const input = document.getElementById('new-task-input');
                if (!input) return;
                
                const val = input.value.trim();
                if(!val) return;
                state.tasks[state.currentShift].push({ id: generateId(), text: val, active: true });
                input.value = '';
                saveState(true); 
                editor.renderList();
            },
            updateText: (id, el) => {
                const t = state.tasks[state.currentShift].find(x => x.id === id);
                if(t) { t.text = el.innerText; saveState(true); }
            },
            toggleActive: (id) => {
                const t = state.tasks[state.currentShift].find(x => x.id === id);
                if(t) { t.active = !t.active; saveState(true); editor.renderList(); }
            },
            delete: (id) => {
                state.tasks[state.currentShift] = state.tasks[state.currentShift].filter(x => x.id !== id);
                saveState(true); 
                editor.renderList();
            }
        };

        // ========================
        // USER MANAGER LOGIC
        // ========================
        const userManager = {
            openModal: () => {
                const modal = document.getElementById('user-modal');
                if (modal) modal.classList.add('open');
                userManager.renderList();
            },
            closeModal: () => {
                const modal = document.getElementById('user-modal');
                if (modal) modal.classList.remove('open');
                app.renderUserDropdown();
                home.renderUserDropdown();
            },
            renderList: () => {
                const list = document.getElementById('user-list-ui');
                if (!list) return;
                
                list.innerHTML = '';
                state.users.forEach((u, i) => {
                    const div = document.createElement('div');
                    div.className = 'user-list-item';
                    div.innerHTML = `
                        <span>${u}</span>
                        <button class="btn btn-danger btn-sm" onclick="userManager.delete(${i})">Remove</button>
                    `;
                    list.appendChild(div);
                });
            },
            addUser: () => {
                const input = document.getElementById('new-user-input');
                if (!input) return;
                
                const val = input.value.trim();
                if(!val) return;
                if(state.users.includes(val)) { showToast('User already exists', 'error'); return; }
                state.users.push(val);
                input.value = '';
                saveState(true); 
                userManager.renderList();
            },
            delete: (idx) => {
                state.users.splice(idx, 1);
                saveState(true); 
                userManager.renderList();
            }
        };

        // ========================
        // DASHBOARD LOGIC
        // ========================
        const home = {
            setMode: (mode) => {
                state.homeMode = mode;
                document.querySelectorAll('.view-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.innerText.toLowerCase() === mode || (mode === 'custom' && btn.innerText === 'Custom'));
                });
                
                const rangeInputs = document.getElementById('custom-range-inputs');
                if(rangeInputs) {
                    if(mode === 'custom') rangeInputs.classList.remove('hidden');
                    else rangeInputs.classList.add('hidden');
                }

                home.render();
            },

            setUserFilter: (val) => {
                state.homeUserFilter = val;
                home.render();
            },

            sortBy: (key) => {
                if (state.sortKey === key) {
                    state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sortKey = key;
                    state.sortOrder = 'desc';
                }
                home.render();
            },

            getProcessedLogs: () => {
                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];
                
                let logs = state.logs.filter(log => {
                    const d = new Date(log.reportDate);
                    const dStr = log.reportDate;

                    if (state.homeMode === 'daily') return dStr === todayStr;
                    else if (state.homeMode === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    else if (state.homeMode === 'yearly') return d.getFullYear() === now.getFullYear();
                    else if (state.homeMode === 'custom') {
                        const startInput = document.getElementById('range-start');
                        const endInput = document.getElementById('range-end');
                        const start = startInput ? startInput.value : todayStr;
                        const end = endInput ? endInput.value : todayStr;
                        return dStr >= start && dStr <= end;
                    }
                    return true;
                });

                if (state.homeUserFilter !== 'ALL') {
                    logs = logs.filter(l => l.user === state.homeUserFilter);
                }

                return logs;
            },

            updateCustomView: () => {
                if(state.homeMode === 'custom') home.render();
            },
            
            renderUserDropdown: () => {
                const userSelect = document.getElementById('home-user-select');
                if (!userSelect) return;
                
                userSelect.innerHTML = '';
                const allOpt = document.createElement('option');
                allOpt.value = 'ALL';
                allOpt.innerText = 'ALL Users';
                userSelect.appendChild(allOpt);
                
                state.users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u;
                    opt.innerText = u;
                    userSelect.appendChild(opt);
                });
                userSelect.value = state.homeUserFilter;
            },

            render: () => {
                const userSelect = document.getElementById('home-user-select');
                if (userSelect && userSelect.options.length !== state.users.length + 1) {
                    home.renderUserDropdown();
                }

                let logs = home.getProcessedLogs();
                
                const statTotal = document.getElementById('stat-total');
                const statAvg = document.getElementById('stat-avg');
                
                if (statTotal) statTotal.innerText = logs.length;
                if (statAvg) {
                    const avg = logs.length ? Math.round(logs.reduce((a,b)=>a+b.percentage, 0)/logs.length) : 0;
                    statAvg.innerText = avg + '%';
                }

                const chartData = [];
                
                if (state.homeMode === 'daily') {
                    const shifts = {A:[], B:[], C:[], G:[]};
                    logs.forEach(l => { if(shifts[l.shift]) shifts[l.shift].push(l.percentage); });
                    Object.keys(shifts).forEach(s => {
                        const arr = shifts[s];
                        const val = arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
                        chartData.push({ label: 'Shift '+s, value: val });
                    });
                } 
                else if (state.homeMode === 'monthly') {
                    const days = {}; 
                    logs.forEach(l => {
                        const day = new Date(l.reportDate).getDate();
                        if(!days[day]) days[day] = [];
                        days[day].push(l.percentage);
                    });
                    Object.keys(days).sort((a,b)=>a-b).forEach(d => {
                        const val = days[d].length ? Math.round(days[d].reduce((a,b)=>a+b,0)/days[d].length) : 0;
                        chartData.push({ label: d+'th', value: val });
                    });
                }
                else if (state.homeMode === 'yearly') {
                    const months = Array(12).fill(0).map(()=>[]); 
                    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    logs.forEach(l => {
                        const m = new Date(l.reportDate).getMonth();
                        months[m].push(l.percentage);
                    });
                    months.forEach((mData, idx) => {
                        if(mData.length) {
                            const val = Math.round(mData.reduce((a,b)=>a+b,0)/mData.length);
                            chartData.push({ label: monthNames[idx], value: val });
                        } else {
                            chartData.push({ label: monthNames[idx], value: 0 });
                        }
                    });
                }
                else if (state.homeMode === 'custom') {
                    const dateMap = {};
                    logs.forEach(l => {
                        if(!dateMap[l.reportDate]) dateMap[l.reportDate] = [];
                        dateMap[l.reportDate].push(l.percentage);
                    });
                    Object.keys(dateMap).sort().forEach(d => {
                        const val = dateMap[d].length ? Math.round(dateMap[d].reduce((a,b)=>a+b,0)/dateMap[d].length) : 0;
                        chartData.push({ label: d.substring(5), value: val });
                    });
                }

                const chartEl = document.getElementById('main-chart');
                if (chartEl) {
                    chartEl.innerHTML = '';
                    if(chartData.length === 0) {
                        chartEl.innerHTML = '<div style="color:var(--secondary); margin:auto;">No data for this period</div>';
                    } else {
                        const maxVal = Math.max(...chartData.map(d => d.value)) || 100;
                        chartData.forEach(d => {
                            const height = (d.value / maxVal) * 100;
                            const group = document.createElement('div');
                            group.className = 'bar-group';
                            group.innerHTML = `
                                <div class="bar" style="height: ${height}%;" data-val="${d.value}%"></div>
                                <div class="bar-label">${d.label}</div>
                            `;
                            chartEl.appendChild(group);
                        });
                    }
                }

                let tableLogs = [...logs];
                tableLogs.sort((a, b) => {
                    let valA = a[state.sortKey];
                    let valB = b[state.sortKey];
                    if (state.sortKey === 'reportDate') {
                        valA = new Date(valA);
                        valB = new Date(valB);
                    }
                    if (valA < valB) return state.sortOrder === 'asc' ? -1 : 1;
                    if (valA > valB) return state.sortOrder === 'asc' ? 1 : -1;
                    return 0;
                });

                ['reportDate', 'shift', 'user', 'percentage'].forEach(k => {
                    const icon = document.getElementById(`sort-${k}`);
                    if(icon) {
                        if(state.sortKey === k) {
                            icon.innerText = state.sortOrder === 'asc' ? 'â–²' : 'â–¼';
                            icon.style.color = 'var(--primary)';
                        } else {
                            icon.innerText = 'â¬';
                            icon.style.color = 'var(--secondary)';
                        }
                    }
                });

                const tbody = document.getElementById('log-table-body');
                if (tbody) {
                    tbody.innerHTML = '';
                    tableLogs.slice(0, 20).forEach(l => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${l.reportDate}</td>
                            <td><span style="font-weight:bold">${l.shift}</span></td>
                            <td>${l.user}</td>
                            <td>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <div style="flex:1; height:6px; background:#e2e8f0; border-radius:3px; width:60px;">
                                        <div style="width:${l.percentage}%; height:100%; background:var(--success); border-radius:3px;"></div>
                                    </div>
                                    ${l.percentage}%
                                </div>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }
        };
        
        const dashboard = {
            setMode: (mode) => {
                state.dashboardMode = mode;
                document.querySelectorAll('.view-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.innerText.toLowerCase() === mode || (mode === 'custom' && btn.innerText === 'Custom'));
                });
                
                const rangeInputs = document.getElementById('custom-range-inputs');
                if(rangeInputs) {
                    if(mode === 'custom') rangeInputs.classList.remove('hidden');
                    else rangeInputs.classList.add('hidden');
                }

                dashboard.render();
            },
            
            setUserFilter: (val) => {
                state.dashboardUserFilter = val;
                dashboard.render();
            },
            
            updateCustomView: () => {
                if(state.dashboardMode === 'custom') dashboard.render();
            },
            
            sortBy: (key) => {
                if (state.dashboardSortKey === key) {
                    state.dashboardSortOrder = state.dashboardSortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    state.dashboardSortKey = key;
                    state.dashboardSortOrder = 'desc';
                }
                dashboard.render();
            },
            
            render: () => {
                // Initialize dashboard controls
                const dashUserSelect = document.getElementById('dash-user-select');
                if (dashUserSelect && dashUserSelect.options.length !== state.users.length + 1) {
                    // Populate user filter dropdown
                    dashUserSelect.innerHTML = '<option value="">All Users</option>';
                    state.users.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user;
                        option.textContent = user;
                        dashUserSelect.appendChild(option);
                    });
                    dashUserSelect.value = state.dashboardUserFilter || '';
                }
                
                // Calculate and display stats
                let logs = dashboard.getProcessedLogs();
                
                const statTotal = document.getElementById('stat-total');
                const statAvg = document.getElementById('stat-avg');
                
                if (statTotal) statTotal.innerText = logs.length;
                if (statAvg) {
                    const avg = logs.length ? Math.round(logs.reduce((a,b)=>a+b.percentage, 0)/logs.length) : 0;
                    statAvg.innerText = avg + '%';
                }
                
                // Render chart
                const chartData = [];
                
                if (state.dashboardMode === 'daily') {
                    const shifts = {A:[], B:[], C:[], G:[]};
                    logs.forEach(l => { if(shifts[l.shift]) shifts[l.shift].push(l.percentage); });
                    Object.keys(shifts).forEach(s => {
                        const arr = shifts[s];
                        const val = arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
                        chartData.push({ label: 'Shift '+s, value: val });
                    });
                } 
                else if (state.dashboardMode === 'monthly') {
                    const days = {};
                    logs.forEach(l => {
                        const day = new Date(l.reportDate).getDate();
                        if(!days[day]) days[day] = [];
                        days[day].push(l.percentage);
                    });
                    Object.keys(days).sort((a,b)=>a-b).forEach(d => {
                        const val = days[d].length ? Math.round(days[d].reduce((a,b)=>a+b,0)/days[d].length) : 0;
                        chartData.push({ label: d+'th', value: val });
                    });
                }
                else if (state.dashboardMode === 'yearly') {
                    const months = Array(12).fill(0).map(()=>[]);
                    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    logs.forEach(l => {
                        const m = new Date(l.reportDate).getMonth();
                        months[m].push(l.percentage);
                    });
                    months.forEach((mData, idx) => {
                        if(mData.length) {
                            const val = Math.round(mData.reduce((a,b)=>a+b,0)/mData.length);
                            chartData.push({ label: monthNames[idx], value: val });
                        } else {
                            chartData.push({ label: monthNames[idx], value: 0 });
                        }
                    });
                }
                else if (state.dashboardMode === 'custom') {
                    const dateMap = {};
                    logs.forEach(l => {
                        if(!dateMap[l.reportDate]) dateMap[l.reportDate] = [];
                        dateMap[l.reportDate].push(l.percentage);
                    });
                    Object.keys(dateMap).sort().forEach(d => {
                        const val = dateMap[d].length ? Math.round(dateMap[d].reduce((a,b)=>a+b,0)/dateMap[d].length) : 0;
                        chartData.push({ label: d.substring(5), value: val });
                    });
                }

                const chartEl = document.getElementById('main-chart');
                if (chartEl) {
                    chartEl.innerHTML = '';
                    if(chartData.length === 0) {
                        chartEl.innerHTML = '<div style="color:var(--secondary); margin:auto;">No data for this period</div>';
                    } else {
                        const maxVal = Math.max(...chartData.map(d => d.value)) || 100;
                        chartData.forEach(d => {
                            const height = (d.value / maxVal) * 100;
                            const group = document.createElement('div');
                            group.className = 'bar-group';
                            group.innerHTML = `
                                <div class="bar" style="height: ${height}%;" data-val="${d.value}%"></div>
                                <div class="bar-label">${d.label}</div>
                            `;
                            chartEl.appendChild(group);
                        });
                    }
                }
                
                // Sort and render log table
                let tableLogs = [...logs];
                tableLogs.sort((a, b) => {
                    let valA = a[state.dashboardSortKey];
                    let valB = b[state.dashboardSortKey];
                    if (state.dashboardSortKey === 'reportDate') {
                        valA = new Date(valA);
                        valB = new Date(valB);
                    }
                    if (valA < valB) return state.dashboardSortOrder === 'asc' ? -1 : 1;
                    if (valA > valB) return state.dashboardSortOrder === 'asc' ? 1 : -1;
                    return 0;
                });

                ['reportDate', 'shift', 'user', 'percentage'].forEach(k => {
                    const icon = document.getElementById(`sort-${k}`);
                    if(icon) {
                        if(state.dashboardSortKey === k) {
                            icon.innerText = state.dashboardSortOrder === 'asc' ? '▲' : '▼';
                            icon.style.color = 'var(--primary)';
                        } else {
                            icon.innerText = '⬍';
                            icon.style.color = 'var(--secondary)';
                        }
                    }
                });

                const tbody = document.getElementById('log-table-body');
                if (tbody) {
                    tbody.innerHTML = '';
                    tableLogs.slice(0, 50).forEach(l => {  // Show up to 50 records in dashboard
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${l.reportDate}</td>
                            <td><span style="font-weight:bold">${l.shift}</span></td>
                            <td>${l.user}</td>
                            <td>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <div style="flex:1; height:6px; background:#e2e8f0; border-radius:3px; width:60px;">
                                        <div style="width:${l.percentage}%; height:100%; background:var(--success); border-radius:3px;"></div>
                                    </div>
                                    ${l.percentage}%
                                </div>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            },
            
            getProcessedLogs: () => {
                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];
                
                let logs = state.logs.filter(log => {
                    const d = new Date(log.reportDate);
                    const dStr = log.reportDate;
                    
                    if (state.dashboardMode === 'daily') return dStr === todayStr;
                    else if (state.dashboardMode === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    else if (state.dashboardMode === 'yearly') return d.getFullYear() === now.getFullYear();
                    else if (state.dashboardMode === 'custom') {
                        const startInput = document.getElementById('range-start');
                        const endInput = document.getElementById('range-end');
                        const start = startInput ? startInput.value : todayStr;
                        const end = endInput ? endInput.value : todayStr;
                        return dStr >= start && dStr <= end;
                    }
                    return true;
                });

                if (state.dashboardUserFilter) {
                    logs = logs.filter(l => l.user === state.dashboardUserFilter);
                }

                return logs;
            }
        };

        // ========================
        // INITIALIZE APPLICATION
        // ========================
        window.addEventListener('DOMContentLoaded', () => {
            app.init();
        });
