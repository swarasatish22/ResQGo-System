/**

* =========================================================
* ResQGo Frontend
* Connected with Express + MySQL Backend
* FINAL CLEAN VERSION
* =========================================================
  */
const API_BASE = "/api";
// =========================================================
// SESSION HELPERS
// =========================================================
function getToken() {
    return localStorage.getItem("resqgo_token");
}
function getCurrentUser() {
    try {
        const user = localStorage.getItem("resqgo_user");
        return user ? JSON.parse(user) : null;
    } catch (error) {
        console.error("Session read error:", error);
        return null;
    }
}
function saveSession(token, user) {
    if (token) {
        localStorage.setItem("resqgo_token", token);
    }


    if (user) {
        localStorage.setItem(
            "resqgo_user",
            JSON.stringify(user)
        );
    }


}
function clearSession() {
    localStorage.removeItem("resqgo_token");
    localStorage.removeItem("resqgo_user");
}
// =========================================================
// SECURITY / HTML HELPER
// =========================================================
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, "", ")"
            .replace(/'/g, "'"));
}
// =========================================================
// API REQUEST
// =========================================================

async function apiRequest(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };


    const token = getToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let response;

    try {
        response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });
    } catch (error) {
        console.error("Network error:", error);

        throw new Error(
            "Backend server se connection nahi ho raha. Please server.js start karo."
        );
    }

    let data = {};

    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (!response.ok) {
        if (response.status === 401) {
            clearSession();
        }

        throw new Error(
            data.message ||
            data.error ||
            `Request failed (${response.status})`
        );
    }

    return data;

}
// =========================================================
// UI COMPONENTS
// =========================================================
const Components = {
    // -----------------------------------------------------
    // ALERTS
    // -----------------------------------------------------
    renderAlerts(alerts) {
        const container = document.getElementById("alertContainer");

        if (!container) {
            return;
        }

        if (!Array.isArray(alerts) || alerts.length === 0) {
            container.innerHTML = "";
            return;
        }

        container.innerHTML = alerts.map(alert => `
        <div class="alert-banner">
            <strong>📢 System Alert:</strong>
            ${escapeHtml(
            alert.message ||
            alert.description ||
            ""
        )}
        </div>
    `).join("");
    },


    // -----------------------------------------------------
    // CATEGORIES
    // -----------------------------------------------------
    renderCategories(categories, activeCategory) {
        const container = document.getElementById("categoryPills");

        if (!container) {
            return;
        }

        let html = `
        <div
            class="pill ${activeCategory === "All" ? "active" : ""}"
            onclick="window.app.setCategory('All')"
        >
            All
        </div>
    `;

        if (Array.isArray(categories)) {
            categories.forEach(category => {
                const categoryName = String(category.name || "");

                html += `
                <div
                    class="pill ${activeCategory === categoryName
                        ? "active"
                        : ""}"
                    data-category="${escapeHtml(categoryName)}"
                    onclick="window.app.setCategory(this.dataset.category)"
                >
                    ${category.icon || "🚨"}
                    ${escapeHtml(categoryName)}
                </div>
            `;
            });
        }

        container.innerHTML = html;
    },


    // -----------------------------------------------------
    // RESOURCE TABLE
    // -----------------------------------------------------
    renderResourceTable(resources) {
        const tbody = document.getElementById(
            "resourceDirectoryTable"
        );

        if (!tbody) {
            return;
        }

        if (!Array.isArray(resources) || resources.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    style="text-align:center;"
                >
                    No matching emergency resources found.
                </td>
            </tr>
        `;

            return;
        }

        tbody.innerHTML = resources.map(resource => {

            const lat = Number(
                resource.latitude ??
                resource.lat
            );

            const lng = Number(
                resource.longitude ??
                resource.lng
            );

            return `
            <tr>

                <td>
                    <strong>
                        ${escapeHtml(resource.name)}
                    </strong>
                </td>

                <td>
                    <span class="badge badge-danger">
                        ${escapeHtml(resource.category)}
                    </span>
                </td>

                <td>
                    ${escapeHtml(
                resource.contact_number ??
                resource.contact ??
                "-"
            )}
                </td>

                <td>
                    ${escapeHtml(
                resource.address ||
                "-"
            )}
                </td>

                <td>
                    ${escapeHtml(
                resource.working_hours ??
                resource.hours ??
                "24/7"
            )}
                </td>

                <td>

                    <button
                        class="btn btn-dark btn-sm"
                        onclick="window.app.routeTo(${lat}, ${lng})"
                    >
                        Locate Map
                    </button>

                    <button
                        class="btn btn-danger btn-sm"
                        onclick="window.app.requestService(${Number(resource.id)})"
                    >
                        Request
                    </button>

                </td>

            </tr>
        `;
        }).join("");
    },


    // -----------------------------------------------------
    // INCIDENT LOG
    // -----------------------------------------------------
    renderIncidents(requests, isAdmin) {
        const tbody = document.getElementById(
            "incidentLogTable"
        );

        if (!tbody) {
            return;
        }

        if (!Array.isArray(requests) || requests.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    style="text-align:center;"
                >
                    No emergency requests found.
                </td>
            </tr>
        `;

            return;
        }

        tbody.innerHTML = requests.map(request => {

            const status = String(
                request.status ||
                "Pending"
            ).toUpperCase();

            const statusClass = status === "RESOLVED"
                ? "badge-success"
                : "badge-admin";

            return `
            <tr>

                <td>
                    #${escapeHtml(request.id)}
                </td>

                <td>
                    ${escapeHtml(
                request.service_type ||
                request.type ||
                "Emergency Request"
            )}
                </td>

                <td>
                    ${escapeHtml(
                request.requested_at ||
                request.timestamp ||
                "-"
            )}
                </td>

                <td>
                    <span class="badge ${statusClass}">
                        ${escapeHtml(status)}
                    </span>
                </td>

                <td>
                    ${isAdmin
                    ? "Admin"
                    : "Emergency Request"}
                </td>

            </tr>
        `;
        }).join("");
    },


    // -----------------------------------------------------
    // ADMIN RESOURCE TABLE
    // -----------------------------------------------------
    renderAdminResourceTable(resources) {
        const tbody = document.getElementById(
            "adminResourceTable"
        );

        if (!tbody) {
            return;
        }

        if (!Array.isArray(resources) || resources.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td
                    colspan="3"
                    style="text-align:center;"
                >
                    No resources available.
                </td>
            </tr>
        `;

            return;
        }

        tbody.innerHTML = resources.map(resource => `
        <tr>

            <td>
                <strong>
                    ${escapeHtml(resource.name)}
                </strong>
            </td>

            <td>
                ${escapeHtml(resource.category)}
            </td>

            <td>

                <button
                    class="btn btn-dark btn-sm"
                    onclick="window.app.editResource(${Number(resource.id)})"
                >
                    Edit
                </button>

                <button
                    class="btn btn-danger btn-sm"
                    onclick="window.app.deleteResource(${Number(resource.id)})"
                >
                    Delete
                </button>

            </td>

        </tr>
    `).join("");
    }
};
// =========================================================
// APPLICATION
// =========================================================
class Application {

    constructor() {

        this.state = {
            currentUser: getCurrentUser(),

            activeView: "auth",

            selectedCategory: "All",

            searchQuery: "",

            categories: [
                {
                    id: 1,
                    name: "Hospitals",
                    icon: "🏥"
                },
                {
                    id: 2,
                    name: "Ambulance",
                    icon: "🚑"
                },
                {
                    id: 3,
                    name: "Police",
                    icon: "👮"
                },
                {
                    id: 4,
                    name: "Fire Stations",
                    icon: "🚒"
                }
            ],

            resources: [],

            requests: [],

            alerts: []
        };

        this.map = null;

        this.mapMarkers = [];

        this.init();
    }


    // =====================================================
    // INIT
    // =====================================================
    async init() {

        this.bindEvents();

        if (this.state.currentUser &&
            getToken()) {

            try {

                await this.loadCurrentUser();

                await this.loadAlerts();

                await this.loadResources();

                this.updateRbacUI();

                this.navigateTo("dashboard");

            } catch (error) {

                console.error(
                    "Initialization error:",
                    error
                );

                clearSession();

                this.state.currentUser = null;

                this.updateRbacUI();

                this.navigateTo("auth");
            }

        } else {

            this.updateRbacUI();

            this.navigateTo("auth");
        }
    }


    // =====================================================
    // EVENTS
    // =====================================================
    bindEvents() {

        document
            .getElementById("loginForm")
            ?.addEventListener(
                "submit",
                e => this.handleLogin(e)
            );


        document
            .getElementById("registerForm")
            ?.addEventListener(
                "submit",
                e => this.handleRegister(e)
            );


        document
            .getElementById("logoutBtn")
            ?.addEventListener(
                "click",
                () => this.handleLogout()
            );


        document
            .querySelectorAll(".nav-item")
            .forEach(link => {

                link.addEventListener(
                    "click",
                    e => {

                        e.preventDefault();

                        const view = e.currentTarget.getAttribute(
                            "data-view"
                        );

                        if (view) {
                            this.navigateTo(view);
                        }
                    }
                );
            });


        document
            .getElementById("resourceSearch")
            ?.addEventListener(
                "input",
                e => {

                    this.state.searchQuery =
                        e.target.value
                            .trim()
                            .toLowerCase();

                    this.applyFilters();
                }
            );


        document
            .getElementById("triggerSosBtn")
            ?.addEventListener(
                "click",
                () => this.triggerSos()
            );


        document
            .getElementById("adminAddResourceForm")
            ?.addEventListener(
                "submit",
                e => this.adminSaveResource(e)
            );


        document
            .getElementById("adminCancelEditBtn")
            ?.addEventListener(
                "click",
                () => this.resetAdminForm()
            );


        document
            .getElementById("adminAlertForm")
            ?.addEventListener(
                "submit",
                e => this.adminBroadcastAlert(e)
            );


        document
            .getElementById("profileForm")
            ?.addEventListener(
                "submit",
                e => this.saveProfile(e)
            );
    }


    // =====================================================
    // REGISTER
    // =====================================================
    async handleRegister(e) {

        e.preventDefault();

        const name = document
            .getElementById("regName")
            ?.value
            .trim();

        const email = document
            .getElementById("regEmail")
            ?.value
            .trim();

        const phone = document
            .getElementById("regPhone")
            ?.value
            .trim();

        const password = document
            .getElementById("regPass")
            ?.value;


        if (!name || !email || !password) {

            alert(
                "Name, email and password required."
            );

            return;
        }


        try {

            const data = await apiRequest(
                "/auth/register",
                {
                    method: "POST",

                    body: JSON.stringify({
                        name,
                        email,
                        phone,
                        password
                    })
                }
            );


            alert(
                data.message ||
                "Registration successful."
            );


            document
                .getElementById("registerForm")
                ?.reset();


            const loginEmail = document.getElementById(
                "loginEmail"
            );

            const loginPass = document.getElementById(
                "loginPass"
            );


            if (loginEmail) {
                loginEmail.value = email;
            }

            if (loginPass) {
                loginPass.value = password;
            }

        } catch (error) {

            console.error(
                "Registration error:",
                error
            );

            alert(error.message);
        }
    }


    // =====================================================
    // LOGIN
    // =====================================================
    async handleLogin(e) {

        e.preventDefault();

        const email = document
            .getElementById("loginEmail")
            ?.value
            .trim();

        const password = document
            .getElementById("loginPass")
            ?.value;


        if (!email || !password) {

            alert(
                "Email aur password enter karo."
            );

            return;
        }


        try {

            const data = await apiRequest(
                "/auth/login",
                {
                    method: "POST",

                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );


            if (!data.token) {

                throw new Error(
                    "Login response mein authentication token nahi mila."
                );
            }


            if (!data.user) {

                throw new Error(
                    "Login response mein user data nahi mila."
                );
            }


            saveSession(
                data.token,
                data.user
            );


            this.state.currentUser =
                data.user;


            this.updateRbacUI();


            await this.loadAlerts();

            await this.loadResources();


            this.navigateTo("dashboard");


            alert(
                data.message ||
                "Login successful."
            );


        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            alert(
                error.message ||
                "Login failed."
            );
        }
    }


    // =====================================================
    // CURRENT USER
    // =====================================================
    async loadCurrentUser() {

        const data = await apiRequest(
            "/auth/me"
        );


        if (!data.user) {

            throw new Error(
                "User session invalid."
            );
        }


        this.state.currentUser =
            data.user;


        localStorage.setItem(
            "resqgo_user",
            JSON.stringify(data.user)
        );
    }


    // =====================================================
    // LOGOUT
    // =====================================================
    handleLogout() {

        clearSession();

        this.state.currentUser = null;

        this.state.resources = [];

        this.state.requests = [];

        this.state.alerts = [];

        this.map = null;

        this.mapMarkers = [];

        this.updateRbacUI();

        this.navigateTo("auth");
    }


    // =====================================================
    // RBAC
    // =====================================================
    isAdmin() {

        const role = String(
            this.state.currentUser?.role ||
            ""
        )
            .trim()
            .toLowerCase();

        return (
            role === "admin" ||
            role === "administrator"
        );
    }


    updateRbacUI() {

        const navMenu = document.getElementById(
            "navMenu"
        );

        const badge = document.getElementById(
            "userRoleBadge"
        );

        const adminElements = document.querySelectorAll(
            ".admin-only"
        );


        if (!this.state.currentUser) {

            if (navMenu) {
                navMenu.style.display = "none";
            }

            adminElements.forEach(
                element => {
                    element.style.display =
                        "none";
                }
            );

            if (badge) {
                badge.innerText = "";
            }

            return;
        }


        if (navMenu) {
            navMenu.style.display = "flex";
        }


        if (badge) {

            badge.innerText =
                `Role: ${this.state.currentUser.role ||
                "user"}`;
        }


        adminElements.forEach(
            element => {

                element.style.display =
                    this.isAdmin()
                        ? "inline-block"
                        : "none";
            }
        );
    }


    // =====================================================
    // ROUTER
    // =====================================================
    navigateTo(viewId) {

        if (!this.state.currentUser &&
            viewId !== "auth") {

            alert(
                "Please login first."
            );

            return;
        }


        if (viewId === "admin" &&
            !this.isAdmin()) {

            alert(
                "SECURITY ERROR: Admin access denied."
            );

            return;
        }


        document
            .querySelectorAll(".app-view")
            .forEach(view => {

                view.style.display =
                    "none";
            });


        document
            .querySelectorAll(".nav-item")
            .forEach(item => {

                item.classList.remove(
                    "active"
                );
            });


        const target = document.getElementById(
            `view-${viewId}`
        );


        if (!target) {

            console.error(
                `View not found: view-${viewId}`
            );

            return;
        }


        target.style.display = "block";

        this.state.activeView =
            viewId;


        const activeNav = document.querySelector(
            `.nav-item[data-view="${viewId}"]`
        );


        if (activeNav) {
            activeNav.classList.add("active");
        }


        if (viewId === "dashboard") {

            this.initMap();

            this.loadRequests();
        }


        if (viewId === "resources") {

            this.refreshResourcesView();
        }


        if (viewId === "admin") {

            this.refreshAdminView();
        }


        if (viewId === "profile") {

            this.loadProfile();
        }
    }


    // =====================================================
    // RESOURCES
    // =====================================================
    async loadResources() {

        try {

            const data = await apiRequest(
                "/resources"
            );


            this.state.resources =
                Array.isArray(data.resources)
                    ? data.resources
                    : [];


            console.log(
                "Resources loaded:",
                this.state.resources
            );


            this.applyFilters();

            this.renderMapMarkers();


            return this.state.resources;


        } catch (error) {

            console.error(
                "Resources loading error:",
                error
            );

            throw error;
        }
    }


    async refreshResourcesView() {

        Components.renderCategories(
            this.state.categories,
            this.state.selectedCategory
        );

        try {

            await this.loadResources();

        } catch (error) {

            alert(
                "Resources load nahi ho pa rahe.\n\n" +
                error.message
            );
        }
    }


    async setCategory(category) {

        this.state.selectedCategory =
            category;

        await this.refreshResourcesView();
    }


    applyFilters() {

        let resources = [...this.state.resources];


        if (this.state.searchQuery) {

            const search = this.state.searchQuery;


            resources =
                resources.filter(
                    resource => {

                        const name = String(
                            resource.name ||
                            ""
                        )
                            .toLowerCase();


                        const description = String(
                            resource.description ||
                            ""
                        )
                            .toLowerCase();


                        const address = String(
                            resource.address ||
                            ""
                        )
                            .toLowerCase();


                        const category = String(
                            resource.category ||
                            ""
                        )
                            .toLowerCase();


                        return (
                            name.includes(search) ||
                            description.includes(search) ||
                            address.includes(search) ||
                            category.includes(search)
                        );
                    }
                );
        }


        if (this.state.selectedCategory !==
            "All") {

            resources =
                resources.filter(
                    resource => {

                        return (
                            String(
                                resource.category ||
                                ""
                            )
                                .trim()
                                .toLowerCase() ===
                            String(
                                this.state.selectedCategory
                            )
                                .trim()
                                .toLowerCase()
                        );
                    }
                );
        }


        Components.renderResourceTable(
            resources
        );
    }


    // =====================================================
    // MAP
    // =====================================================
    initMap() {

        const mapElement = document.getElementById(
            "map"
        );


        if (!mapElement) {
            return;
        }


        if (!this.map) {

            this.map =
                L.map("map").setView(
                    [19.0760, 72.8777],
                    12
                );


            L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    attribution: "&copy; OpenStreetMap contributors"
                }
            ).addTo(this.map);
        }


        setTimeout(
            () => {

                if (this.map) {

                    this.map.invalidateSize();

                    this.renderMapMarkers();
                }
            },
            300
        );
    }


    renderMapMarkers() {

        if (!this.map) {
            return;
        }


        this.mapMarkers.forEach(
            marker => {

                this.map.removeLayer(
                    marker
                );
            }
        );


        this.mapMarkers = [];


        this.state.resources.forEach(
            resource => {

                const lat = Number(
                    resource.latitude ??
                    resource.lat
                );


                const lng = Number(
                    resource.longitude ??
                    resource.lng
                );


                if (!Number.isFinite(lat) ||
                    !Number.isFinite(lng)) {

                    return;
                }


                const marker = L.marker(
                    [lat, lng]
                )
                    .addTo(this.map)
                    .bindPopup(`
                    <b>
                        ${escapeHtml(
                        resource.name
                    )}
                    </b>

                    <br>

                    ${escapeHtml(
                        resource.category ||
                        ""
                    )}

                    <br>

                    📞 ${escapeHtml(
                        resource.contact_number ??
                        resource.contact ??
                        "-"
                    )}

                    <br>

                    ${escapeHtml(
                        resource.address ||
                        ""
                    )}
                `);


                this.mapMarkers.push(
                    marker
                );
            }
        );
    }


    routeTo(lat, lng) {

        lat = Number(lat);

        lng = Number(lng);


        if (!Number.isFinite(lat) ||
            !Number.isFinite(lng)) {

            alert(
                "Is resource ke coordinates available nahi hain."
            );

            return;
        }


        this.navigateTo("dashboard");


        setTimeout(
            () => {

                if (this.map) {

                    this.map.setView(
                        [lat, lng],
                        16
                    );
                }
            },
            300
        );
    }


    // =====================================================
    // SOS
    // =====================================================
    async triggerSos() {

        if (!this.state.currentUser) {

            alert(
                "Please login first."
            );

            return;
        }


        try {

            await this.loadResources();

        } catch (error) {

            console.error(
                "Fresh resource loading failed:",
                error
            );

            alert(
                "Emergency resources load nahi ho pa rahe.\n\n" +
                error.message
            );

            return;
        }


        const ambulance = this.state.resources.find(
            resource => {

                const category = String(
                    resource.category ||
                    ""
                )
                    .trim()
                    .toLowerCase();


                const name = String(
                    resource.name ||
                    ""
                )
                    .trim()
                    .toLowerCase();


                return (
                    category === "ambulance" ||
                    name.includes("ambulance")
                );
            }
        );


        console.log(
            "Ambulance selected for SOS:",
            ambulance
        );


        if (!ambulance) {

            alert(
                "No ambulance resource available.\n\n" +
                "Admin Panel → Add Resource → Category: Ambulance"
            );

            return;
        }


        const confirmed = confirm(
            "🚨 Kya aap emergency SOS dispatch karna chahte ho?"
        );


        if (!confirmed) {
            return;
        }


        try {

            const data = await apiRequest(
                "/requests",
                {
                    method: "POST",

                    body: JSON.stringify({
                        resourceId: Number(
                            ambulance.id
                        ),

                        serviceType: "User SOS Alert",

                        phoneNumber: this.state.currentUser.phone ||
                            null
                    })
                }
            );


            alert(
                `🚨 SOS DISPATCHED!

Request #${data.id || data.requestId || "-"}

Ambulance: ${ambulance.name}`
            );

            await this.loadRequests();


        } catch (error) {

            console.error(
                "SOS error:",
                error
            );

            alert(
                error.message
            );
        }
    }

    // =====================================================
    // REQUEST SERVICE
    // =====================================================
    async requestService(resourceId) {

        if (!this.state.currentUser) {

            alert(
                "Please login first."
            );

            return;
        }


        let resource = this.state.resources.find(
            item => Number(item.id) ===
                Number(resourceId)
        );


        if (!resource) {

            try {

                await this.loadResources();

            } catch (error) {

                alert(error.message);

                return;
            }


            resource =
                this.state.resources.find(
                    item => Number(item.id) ===
                        Number(resourceId)
                );


            if (!resource) {

                alert(
                    "Resource not found."
                );

                return;
            }
        }


        const confirmed = confirm(
            `Emergency request ${resource.name} ko bhejni hai?`
        );


        if (!confirmed) {
            return;
        }


        const category = String(
            resource.category ||
            ""
        )
            .trim();


        const serviceType = category.toLowerCase() ===
            "ambulance"

            ? "Ambulance Assistance"

            : `${category} Emergency Assistance`;


        try {

            const data = await apiRequest(
                "/requests",
                {
                    method: "POST",

                    body: JSON.stringify({
                        resourceId: Number(
                            resource.id
                        ),

                        serviceType,

                        phoneNumber: this.state.currentUser?.phone ||
                            null
                    })
                }
            );


            alert(
                `Emergency request created.
` ``,

                Request, #$, { data, : .id || data.requestId || "-" } `
);

        await this.loadRequests();


    } catch (error) {

        console.error(
            "Service request error:",
            error
        );

        alert(
            error.message
        );
    }
}


// =====================================================
// REQUESTS
// =====================================================

async loadRequests() {

    try {

        const data =
            await apiRequest(
                "/requests"
            );


        this.state.requests =
            Array.isArray(data.requests)
                ? data.requests
                : [];


        Components.renderIncidents(
            this.state.requests,
            this.isAdmin()
        );


        return this.state.requests;


    } catch (error) {

        console.error(
            "Request loading error:",
            error
        );

        Components.renderIncidents(
            [],
            this.isAdmin()
        );

        return [];
    }
}


// =====================================================
// ALERTS
// =====================================================

async loadAlerts() {

    try {

        const data =
            await apiRequest(
                "/alerts"
            );


        this.state.alerts =
            Array.isArray(data.alerts)
                ? data.alerts
                : [];


        Components.renderAlerts(
            this.state.alerts
        );


        return this.state.alerts;


    } catch (error) {

        console.error(
            "Alert loading error:",
            error
        );

        Components.renderAlerts([]);

        return [];
    }
}


// =====================================================
// PROFILE
// =====================================================

loadProfile() {

    const user =
        this.state.currentUser;


    if (!user) {
        return;
    }


    const name =
        document.getElementById(
            "profName"
        );

    const email =
        document.getElementById(
            "profEmail"
        );

    const phone =
        document.getElementById(
            "profPhone"
        );


    if (name) {

        name.value =
            user.name ||
            "";
    }


    if (email) {

        email.value =
            user.email ||
            "";
    }


    if (phone) {

        phone.value =
            user.phone ||
            "";
    }
}


async saveProfile(e) {

    e.preventDefault();


    const name =
        document
            .getElementById("profName")
            ?.value
            .trim();


    const phone =
        document
            .getElementById("profPhone")
            ?.value
            .trim();


    if (!name) {

        alert(
            "Name required."
        );

        return;
    }


    try {

        const data =
            await apiRequest(
                "/auth/profile",
                {
                    method: "PUT",

                    body: JSON.stringify({
                        name,
                        phone
                    })
                }
            );


        if (data.user) {

            this.state.currentUser =
                data.user;


            localStorage.setItem(
                "resqgo_user",
                JSON.stringify(
                    data.user
                )
            );
        }


        this.updateRbacUI();


        alert(
            data.message ||
            "Profile updated successfully."
        );


    } catch (error) {

        console.error(
            "Profile update error:",
            error
        );

        alert(
            error.message
        );
    }
}


// =====================================================
// ADMIN PANEL
// =====================================================

async refreshAdminView() {

    if (!this.isAdmin()) {

        alert(
            "Admin access required."
        );

        return;
    }


    this.populateAdminFormOptions();


    try {

        const data =
            await apiRequest(
                "/resources"
            );


        this.state.resources =
            Array.isArray(data.resources)
                ? data.resources
                : [];


        Components.renderAdminResourceTable(
            this.state.resources
        );


    } catch (error) {

        console.error(
            "Admin resources error:",
            error
        );

        alert(
            error.message
        );
    }
}


populateAdminFormOptions() {

    const select =
        document.getElementById(
            "admResCategory"
        );


    if (!select) {
        return;
    }


    select.innerHTML =
        this.state.categories
            .map(
                category => `
            < option,
                value = "${escapeHtml(",
                category.name
            );
        } finally { } ""
            >
            $; {
                escapeHtml(
                    category.name
                );
        }
        option >
            `
            )
            .join("");
}


// =====================================================
// ADMIN SAVE RESOURCE
// =====================================================

async adminSaveResource(e) {

    e.preventDefault();


    if (!this.isAdmin()) {

        alert(
            "Admin access required."
        );

        return;
    }


    const editId =
        document
            .getElementById(
                "admResId"
            )
            ?.value
            .trim();


    const name =
        document
            .getElementById(
                "admResName"
            )
            ?.value
            .trim();


    const category =
        document
            .getElementById(
                "admResCategory"
            )
            ?.value;


    const contact =
        document
            .getElementById(
                "admResContact"
            )
            ?.value
            .trim();


    const address =
        document
            .getElementById(
                "admResAddress"
            )
            ?.value
            .trim();


    const latitude =
        parseFloat(
            document
                .getElementById(
                    "admResLat"
                )
                ?.value
        );


    const longitude =
        parseFloat(
            document
                .getElementById(
                    "admResLng"
                )
                ?.value
        );


    if (
        !name ||
        !category ||
        !address ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {

        alert(
            "Please saari required details properly enter karo."
        );

        return;
    }


    try {

        const payload = {

            name,

            description:
                `; $; { category; } emergency; resource`,

            category,

            address,

            latitude,

            longitude,

            contactNumber:
                contact || null,

            workingHours:
                "24/7"
        };


        let data;


        if (editId) {

            data =
                await apiRequest(
                    ` / resources / $; { editId; } `,
                    {
                        method: "PUT",

                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );

        } else {

            data =
                await apiRequest(
                    "/resources",
                    {
                        method: "POST",

                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );
        }


        alert(
            data.message ||
            (
                editId
                    ? "Resource updated."
                    : "Resource added."
            )
        );


        this.resetAdminForm();


        await this.loadResources();

        await this.refreshAdminView();


    } catch (error) {

        console.error(
            "Admin resource error:",
            error
        );

        alert(
            error.message
        );
    }
}


// =====================================================
// EDIT RESOURCE
// =====================================================

async editResource(id) {

    if (!this.isAdmin()) {

        alert(
            "Admin access required."
        );

        return;
    }


    try {

        const data =
            await apiRequest(
                "/resources"
            );


        const resource =
            (data.resources || [])
                .find(
                    item =>
                        Number(item.id) ===
                        Number(id)
                );


        if (!resource) {

            alert(
                "Resource not found."
            );

            return;
        }


        const idField =
            document.getElementById(
                "admResId"
            );

        const nameField =
            document.getElementById(
                "admResName"
            );

        const categoryField =
            document.getElementById(
                "admResCategory"
            );

        const contactField =
            document.getElementById(
                "admResContact"
            );

        const addressField =
            document.getElementById(
                "admResAddress"
            );

        const latField =
            document.getElementById(
                "admResLat"
            );

        const lngField =
            document.getElementById(
                "admResLng"
            );


        if (idField) {

            idField.value =
                resource.id;
        }


        if (nameField) {

            nameField.value =
                resource.name ||
                "";
        }


        if (categoryField) {

            categoryField.value =
                resource.category ||
                "";
        }


        if (contactField) {

            contactField.value =
                resource.contact_number ??
                resource.contact ??
                "";
        }


        if (addressField) {

            addressField.value =
                resource.address ||
                "";
        }


        if (latField) {

            latField.value =
                resource.latitude ??
                resource.lat ??
                "";
        }


        if (lngField) {

            lngField.value =
                resource.longitude ??
                resource.lng ??
                "";
        }


        const title =
            document.getElementById(
                "adminFormTitle"
            );


        if (title) {

            title.innerText =
                "Edit Emergency Resource";
        }


        const button =
            document.getElementById(
                "adminFormBtn"
            );


        if (button) {

            button.innerText =
                "Update Resource";
        }


        const cancel =
            document.getElementById(
                "adminCancelEditBtn"
            );


        if (cancel) {

            cancel.style.display =
                "block";
        }


        document
            .getElementById(
                "view-admin"
            )
            ?.scrollIntoView({
                behavior: "smooth"
            });


    } catch (error) {

        console.error(
            "Edit resource error:",
            error
        );

        alert(
            error.message
        );
    }
}


// =====================================================
// DELETE RESOURCE
// =====================================================

async deleteResource(id) {

    if (!this.isAdmin()) {

        alert(
            "Admin access required."
        );

        return;
    }


    const confirmed =
        confirm(
            "Are you sure you want to delete this resource?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const data =
            await apiRequest(
                ` / resources / $; { id; } `,
                {
                    method: "DELETE"
                }
            );


        alert(
            data.message ||
            "Resource deleted."
        );


        await this.loadResources();

        await this.refreshAdminView();


    } catch (error) {

        console.error(
            "Delete resource error:",
            error
        );

        alert(
            error.message
        );
    }
}


// =====================================================
// RESET ADMIN FORM
// =====================================================

resetAdminForm() {

    const form =
        document.getElementById(
            "adminAddResourceForm"
        );


    if (form) {
        form.reset();
    }


    const id =
        document.getElementById(
            "admResId"
        );


    if (id) {
        id.value = "";
    }


    const title =
        document.getElementById(
            "adminFormTitle"
        );


    if (title) {

        title.innerText =
            "Register Emergency Resource";
    }


    const button =
        document.getElementById(
            "adminFormBtn"
        );


    if (button) {

        button.innerText =
            "Add Resource";
    }


    const cancel =
        document.getElementById(
            "adminCancelEditBtn"
        );


    if (cancel) {

        cancel.style.display =
            "none";
    }
}


// =====================================================
// BROADCAST ALERT
// =====================================================

async adminBroadcastAlert(e) {

    e.preventDefault();


    if (!this.isAdmin()) {

        alert(
            "Admin access required."
        );

        return;
    }


    const input =
        document.getElementById(
            "admAlertMsg"
        );


    const message =
        input?.value.trim();


    if (!message) {

        alert(
            "Broadcast message enter karo."
        );

        return;
    }


    try {

        const data =
            await apiRequest(
                "/alerts",
                {
                    method: "POST",

                    body: JSON.stringify({
                        message
                    })
                }
            );


        alert(
            data.message ||
            "Alert broadcast successfully."
        );


        document
            .getElementById(
                "adminAlertForm"
            )
            ?.reset();


        await this.loadAlerts();


    } catch (error) {

        console.error(
            "Broadcast alert error:",
            error
        );

        alert(
            error.message
        );
    }
}
` ``;

    }

    // =========================================================
    // START APPLICATION
    // =========================================================
    window; addEventListener(
    );
}
() => {

    `` `
    window.app =
        new Application();

}


);
`;
};
