/**
 * =========================================================
 * ResQGo Frontend
 * Connected with Express + MySQL Backend
 * =========================================================
 */

const API_BASE =
    window.location.protocol === "file:"
        ? "http://localhost:5000/api"
        : "/api";

/* =========================================================
   GLOBAL LOCATION / REQUEST STATE
========================================================= */

let userLocation = null;
let requestStatusSnapshot = {};
let requestPollTimer = null;

/* =========================================================
   SESSION HELPERS
========================================================= */

function getToken() {
    return localStorage.getItem("resqgo_token");
}

function getCurrentUser() {
    try {
        return JSON.parse(
            localStorage.getItem("resqgo_user")
        );
    } catch {
        return null;
    }
}

function saveSession(token, user) {
    localStorage.setItem(
        "resqgo_token",
        token
    );

    localStorage.setItem(
        "resqgo_user",
        JSON.stringify(user)
    );
}

function clearSession() {
    localStorage.removeItem("resqgo_token");
    localStorage.removeItem("resqgo_user");
}

/* =========================================================
   SECURITY
========================================================= */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   API
========================================================= */

async function apiRequest(endpoint, options = {}) {

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    const token = getToken();

    if (token) {
        headers.Authorization =
            `Bearer ${token}`;
    }

    const response = await fetch(
        `${API_BASE}${endpoint}`,
        {
            ...options,
            headers
        }
    );

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            `Request failed (${response.status})`
        );
    }

    return data;
}

/* =========================================================
   LOCATION HELPERS
========================================================= */

function calculateDistanceKm(
    lat1,
    lng1,
    lat2,
    lng2
) {

    const R = 6371;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLng =
        (lng2 - lng1) *
        Math.PI / 180;

    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +
        Math.cos(
            lat1 * Math.PI / 180
        ) *
        Math.cos(
            lat2 * Math.PI / 180
        ) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}

function getResourceCoordinates(resource) {

    const latitude = Number(
        resource.latitude ??
        resource.lat
    );

    const longitude = Number(
        resource.longitude ??
        resource.lng
    );

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {
        return null;
    }

    return {
        latitude,
        longitude
    };
}

/* =========================================================
   UI COMPONENTS
========================================================= */

const Components = {

    renderAlerts(alerts) {

        const container =
            document.getElementById(
                "alertContainer"
            );

        if (!container) return;

        if (
            !Array.isArray(alerts) ||
            alerts.length === 0
        ) {
            container.innerHTML = "";
            return;
        }

        container.innerHTML =
            alerts.map(alert => `
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

    renderCategories(
        categories,
        activeCategory
    ) {

        const container =
            document.getElementById(
                "categoryPills"
            );

        if (!container) return;

        let html = `
            <div
                class="pill ${
                    activeCategory === "All"
                        ? "active"
                        : ""
                }"
                onclick="window.app.setCategory('All')"
            >
                All
            </div>
        `;

        categories.forEach(category => {

            const categoryName =
                String(category.name || "");

            html += `
                <div
                    class="pill ${
                        String(
                            activeCategory || ""
                        ).toLowerCase() ===
                        categoryName.toLowerCase()
                            ? "active"
                            : ""
                    }"
                    data-category="${escapeHtml(
                        categoryName
                    )}"
                    onclick="
                        window.app.setCategory(
                            this.dataset.category
                        )
                    "
                >
                    ${category.icon || "🚨"}
                    ${escapeHtml(categoryName)}
                </div>
            `;
        });

        container.innerHTML = html;
    },

    renderResourceTable(resources) {

        const tbody =
            document.getElementById(
                "resourceDirectoryTable"
            );

        if (!tbody) return;

        if (
            !Array.isArray(resources) ||
            resources.length === 0
        ) {

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

        tbody.innerHTML =
            resources.map(resource => {

                const coordinates =
                    getResourceCoordinates(
                        resource
                    );

                const lat =
                    coordinates
                        ? coordinates.latitude
                        : null;

                const lng =
                    coordinates
                        ? coordinates.longitude
                        : null;

                let distanceText = "";

                if (
                    userLocation &&
                    coordinates
                ) {

                    const distance =
                        calculateDistanceKm(
                            userLocation.latitude,
                            userLocation.longitude,
                            coordinates.latitude,
                            coordinates.longitude
                        );

                    distanceText =
                        `<br><small>
                            📍 ${distance.toFixed(1)} km away
                        </small>`;
                }

                return `
                    <tr>

                        <td>
                            <strong>
                                ${escapeHtml(
                                    resource.name
                                )}
                            </strong>
                            ${distanceText}
                        </td>

                        <td>
                            <span class="badge badge-danger">
                                ${escapeHtml(
                                    resource.category
                                )}
                            </span>
                        </td>

                        <td>
                            ${escapeHtml(
                                resource.contact_number ||
                                resource.contactNumber ||
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
                                resource.working_hours ||
                                resource.workingHours ||
                                "24/7"
                            )}
                        </td>

                        <td>

                            ${
                                coordinates
                                    ? `
                                        <button
                                            class="btn btn-dark btn-sm"
                                            onclick="
                                                window.app.routeTo(
                                                    ${lat},
                                                    ${lng}
                                                )
                                            "
                                        >
                                            Locate Map
                                        </button>
                                    `
                                    : ""
                            }

                            ${
                                resource.contact_number ||
                                resource.contactNumber
                                    ? `
                                        <a
                                            class="btn btn-dark btn-sm"
                                            href="tel:${escapeHtml(
                                                resource.contact_number ||
                                                resource.contactNumber
                                            )}"
                                        >
                                            Call
                                        </a>
                                    `
                                    : ""
                            }

                            <button
                                class="btn btn-danger btn-sm"
                                onclick="
                                    window.app.requestService(
                                        ${Number(resource.id)}
                                    )
                                "
                            >
                                Request
                            </button>

                        </td>

                    </tr>
                `;
            }).join("");
    },

    renderIncidents(
        requests,
        isAdmin
    ) {

        const tbody =
            document.getElementById(
                "incidentLogTable"
            );

        if (!tbody) return;

        if (
            !Array.isArray(requests) ||
            requests.length === 0
        ) {

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

        tbody.innerHTML =
            requests.map(request => {

                const status =
                    String(
                        request.status ||
                        "Pending"
                    ).toUpperCase();

                let statusClass =
                    "badge-admin";

                if (
                    status === "RESOLVED"
                ) {
                    statusClass =
                        "badge-success";
                }

                if (
                    status === "ACCEPTED"
                ) {
                    statusClass =
                        "badge-success";
                }

                return `
                    <tr>

                        <td>
                            #${escapeHtml(
                                request.id
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                request.service_type ||
                                request.serviceType ||
                                "Emergency Request"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                request.requested_at ||
                                request.requestedAt ||
                                "-"
                            )}
                        </td>

                        <td>
                            <span
                                class="badge ${statusClass}"
                            >
                                ${escapeHtml(status)}
                            </span>
                        </td>

                        <td>
                            ${
                                isAdmin
                                    ? "Admin"
                                    : "Emergency Request"
                            }
                        </td>

                    </tr>
                `;
            }).join("");
    },

    renderAdminResourceTable(
        resources
    ) {

        const tbody =
            document.getElementById(
                "adminResourceTable"
            );

        if (!tbody) return;

        if (
            !Array.isArray(resources) ||
            resources.length === 0
        ) {

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

        tbody.innerHTML =
            resources.map(resource => `

                <tr>

                    <td>
                        <strong>
                            ${escapeHtml(
                                resource.name
                            )}
                        </strong>
                    </td>

                    <td>
                        ${escapeHtml(
                            resource.category
                        )}
                    </td>

                    <td>

                        <button
                            type="button"
                            class="btn btn-dark btn-sm"
                            onclick="
                                window.app.editResource(
                                    ${Number(resource.id)}
                                )
                            "
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="btn btn-danger btn-sm"
                            onclick="
                                window.app.deleteResource(
                                    ${Number(resource.id)}
                                )
                            "
                        >
                            Delete
                        </button>

                    </td>

                </tr>

            `).join("");
    }
};

/* =========================================================
   APPLICATION
========================================================= */

class Application {

    constructor() {

        this.state = {

            currentUser:
                getCurrentUser(),

            activeView:
                "auth",

            selectedCategory:
                "All",

            searchQuery:
                "",

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

        this.locationMarker = null;

        this.requestPollTimer = null;

        this.init();
    }

    /* =====================================================
       INIT
    ===================================================== */

    async init() {

        this.bindEvents();

        this.ensureLocationControls();

        if (
            this.state.currentUser &&
            getToken()
        ) {

            try {

                await this.loadCurrentUser();

                await this.loadAlerts();

                await this.loadResources();

                this.updateRbacUI();

                this.navigateTo(
                    "dashboard"
                );

                this.startRequestPolling();

            } catch (error) {

                console.error(
                    "Initialization error:",
                    error
                );

                this.handleLogout();
            }

        } else {

            this.updateRbacUI();

            this.navigateTo(
                "auth"
            );
        }
    }

    /* =====================================================
       EVENTS
    ===================================================== */

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

                        const view =
                            e.currentTarget
                                .getAttribute(
                                    "data-view"
                                );

                        if (view) {
                            this.navigateTo(
                                view
                            );
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
            .getElementById(
                "adminAddResourceForm"
            )
            ?.addEventListener(
                "submit",
                e => this.adminSaveResource(e)
            );

        document
            .getElementById(
                "adminCancelEditBtn"
            )
            ?.addEventListener(
                "click",
                () => this.resetAdminForm()
            );

        document
            .getElementById(
                "adminAlertForm"
            )
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

    /* =====================================================
       LOCATION CONTROLS
    ===================================================== */

    ensureLocationControls() {

        const resourcesView =
            document.getElementById(
                "view-resources"
            );

        if (!resourcesView) {
            return;
        }

        if (
            document.getElementById(
                "resqgoLocationControls"
            )
        ) {
            return;
        }

        const searchInput =
            document.getElementById(
                "resourceSearch"
            );

        if (!searchInput) {
            return;
        }

        const wrapper =
            document.createElement("div");

        wrapper.id =
            "resqgoLocationControls";

        wrapper.style.margin =
            "15px 0";

        wrapper.innerHTML = `

            <div
                style="
                    display:flex;
                    gap:8px;
                    flex-wrap:wrap;
                    align-items:center;
                "
            >

                <input
                    id="resqgoLocationSearch"
                    type="text"
                    placeholder="Search city or area in India"
                    style="
                        padding:10px;
                        min-width:240px;
                        border:1px solid #ccc;
                        border-radius:6px;
                    "
                >

                <button
                    type="button"
                    class="btn btn-dark btn-sm"
                    id="resqgoFindLocationBtn"
                >
                    Find Location
                </button>

                <button
                    type="button"
                    class="btn btn-dark btn-sm"
                    id="resqgoMyLocationBtn"
                >
                    Use My Location
                </button>

                <button
                    type="button"
                    class="btn btn-danger btn-sm"
                    id="resqgoClearLocationBtn"
                >
                    Clear Location
                </button>

            </div>

            <div
                id="resqgoLocationStatus"
                style="
                    margin-top:8px;
                    font-size:14px;
                "
            >
                Location filter is currently off.
            </div>

        `;

        searchInput.parentElement
            ?.insertAdjacentElement(
                "afterend",
                wrapper
            );

        document
            .getElementById(
                "resqgoFindLocationBtn"
            )
            ?.addEventListener(
                "click",
                () => this.searchLocation()
            );

        document
            .getElementById(
                "resqgoMyLocationBtn"
            )
            ?.addEventListener(
                "click",
                () => this.useMyLocation()
            );

        document
            .getElementById(
                "resqgoClearLocationBtn"
            )
            ?.addEventListener(
                "click",
                () => this.clearLocation()
            );

        document
            .getElementById(
                "resqgoLocationSearch"
            )
            ?.addEventListener(
                "keydown",
                e => {

                    if (
                        e.key === "Enter"
                    ) {

                        e.preventDefault();

                        this.searchLocation();
                    }
                }
            );
    }

    setLocationStatus(message) {

        const element =
            document.getElementById(
                "resqgoLocationStatus"
            );

        if (element) {
            element.innerText =
                message;
        }
    }

    async searchLocation() {

        const input =
            document.getElementById(
                "resqgoLocationSearch"
            );

        const query =
            input?.value.trim();

        if (!query) {

            alert(
                "Please enter a city or area."
            );

            return;
        }

        this.setLocationStatus(
            "Searching location..."
        );

        try {

            const data =
                await apiRequest(
                    `/geocode?q=${encodeURIComponent(query)}`
                );

            if (
                !data ||
                !data.latitude ||
                !data.longitude
            ) {

                throw new Error(
                    "Location not found."
                );
            }

            this.setUserLocation(
                Number(data.latitude),
                Number(data.longitude),
                data.display_name ||
                query
            );

        } catch (error) {

            console.error(
                "Location search error:",
                error
            );

            this.setLocationStatus(
                "Location not found."
            );

            alert(
                error.message ||
                "Unable to find this location."
            );
        }
    }

    useMyLocation() {

        if (
            !navigator.geolocation
        ) {

            alert(
                "Geolocation is not supported by this browser."
            );

            return;
        }

        this.setLocationStatus(
            "Detecting your current location..."
        );

        navigator.geolocation.getCurrentPosition(

            position => {

                this.setUserLocation(
                    position.coords.latitude,
                    position.coords.longitude,
                    "Your current location"
                );
            },

            error => {

                console.error(
                    "Geolocation error:",
                    error
                );

                this.setLocationStatus(
                    "Unable to access your location."
                );

                alert(
                    "Unable to access your current location. Please allow location permission or search your city/area manually."
                );
            },

            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    }

    setUserLocation(
        latitude,
        longitude,
        label = "Selected location"
    ) {

        latitude = Number(latitude);
        longitude = Number(longitude);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {

            alert(
                "Invalid location coordinates."
            );

            return;
        }

        userLocation = {
            latitude,
            longitude,
            label
        };

        this.setLocationStatus(
            `📍 ${label} selected. Showing emergency resources within 25 km.`
        );

        this.updateLocationMarker();

        this.applyFilters();

        this.renderMapMarkers();

        if (this.map) {

            this.map.setView(
                [latitude, longitude],
                13
            );
        }
    }

    clearLocation() {

        userLocation = null;

        this.setLocationStatus(
            "Location filter is currently off."
        );

        if (
            this.locationMarker &&
            this.map
        ) {

            try {
                this.map.removeLayer(
                    this.locationMarker
                );
            } catch {}

            this.locationMarker =
                null;
        }

        this.applyFilters();

        this.renderMapMarkers();
    }

    updateLocationMarker() {

        if (!this.map) {
            return;
        }

        if (
            this.locationMarker
        ) {

            try {
                this.map.removeLayer(
                    this.locationMarker
                );
            } catch {}

            this.locationMarker =
                null;
        }

        if (!userLocation) {
            return;
        }

        this.locationMarker =
            L.marker(
                [
                    userLocation.latitude,
                    userLocation.longitude
                ]
            )
            .addTo(this.map)
            .bindPopup(
                `<b>📍 Your Selected Location</b>
                 <br>${escapeHtml(
                     userLocation.label
                 )}`
            );
    }

    /* =====================================================
       REGISTER
    ===================================================== */

    async handleRegister(e) {

        e.preventDefault();

        const name =
            document
                .getElementById("regName")
                ?.value.trim();

        const email =
            document
                .getElementById("regEmail")
                ?.value.trim();

        const phone =
            document
                .getElementById("regPhone")
                ?.value.trim();

        const password =
            document
                .getElementById("regPass")
                ?.value;

        if (
            !name ||
            !email ||
            !password
        ) {

            alert(
                "Name, email and password are required."
            );

            return;
        }

        try {

            const data =
                await apiRequest(
                    "/auth/register",
                    {
                        method: "POST",

                        body:
                            JSON.stringify({
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
                .getElementById(
                    "registerForm"
                )
                ?.reset();

            const loginEmail =
                document.getElementById(
                    "loginEmail"
                );

            const loginPass =
                document.getElementById(
                    "loginPass"
                );

            if (loginEmail) {
                loginEmail.value =
                    email;
            }

            if (loginPass) {
                loginPass.value =
                    password;
            }

        } catch (error) {

            console.error(
                "Registration error:",
                error
            );

            alert(
                error.message
            );
        }
    }

    /* =====================================================
       LOGIN
    ===================================================== */

    async handleLogin(e) {

        e.preventDefault();

        const email =
            document
                .getElementById(
                    "loginEmail"
                )
                ?.value.trim();

        const password =
            document
                .getElementById(
                    "loginPass"
                )
                ?.value;

        if (
            !email ||
            !password
        ) {

            alert(
                "Please enter email and password."
            );

            return;
        }

        try {

            const data =
                await apiRequest(
                    "/auth/login",
                    {
                        method: "POST",

                        body:
                            JSON.stringify({
                                email,
                                password
                            })
                    }
                );

            if (!data.token) {

                throw new Error(
                    "Login successful response did not contain a token."
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

            this.navigateTo(
                "dashboard"
            );

            this.startRequestPolling();

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
                error.message
            );
        }
    }

    /* =====================================================
       CURRENT USER
    ===================================================== */

    async loadCurrentUser() {

        const data =
            await apiRequest(
                "/auth/me"
            );

        if (!data.user) {

            throw new Error(
                "Unable to load current user."
            );
        }

        this.state.currentUser =
            data.user;

        localStorage.setItem(
            "resqgo_user",
            JSON.stringify(
                data.user
            )
        );
    }

    /* =====================================================
       LOGOUT
    ===================================================== */

    handleLogout() {

        clearSession();

        this.state.currentUser =
            null;

        this.state.resources =
            [];

        this.state.requests =
            [];

        this.state.alerts =
            [];

        userLocation = null;

        requestStatusSnapshot =
            {};

        if (
            this.requestPollTimer
        ) {

            clearInterval(
                this.requestPollTimer
            );

            this.requestPollTimer =
                null;
        }

        if (
            this.locationMarker &&
            this.map
        ) {

            try {
                this.map.removeLayer(
                    this.locationMarker
                );
            } catch {}

            this.locationMarker =
                null;
        }

        this.map = null;

        this.mapMarkers = [];

        this.updateRbacUI();

        this.navigateTo(
            "auth"
        );
    }

    /* =====================================================
       RBAC
    ===================================================== */

    isAdmin() {

        return (
            String(
                this.state.currentUser?.role ||
                ""
            ).toLowerCase() ===
            "admin"
        );
    }

    updateRbacUI() {

        const navMenu =
            document.getElementById(
                "navMenu"
            );

        const badge =
            document.getElementById(
                "userRoleBadge"
            );

        const adminElements =
            document.querySelectorAll(
                ".admin-only"
            );

        if (
            !this.state.currentUser
        ) {

            if (navMenu) {
                navMenu.style.display =
                    "none";
            }

            adminElements.forEach(
                element => {
                    element.style.display =
                        "none";
                }
            );

            return;
        }

        if (navMenu) {
            navMenu.style.display =
                "flex";
        }

        if (badge) {

            badge.innerText =
                `Role: ${
                    this.state.currentUser.role ||
                    "user"
                }`;
        }

        adminElements.forEach(
            element => {

                element.style.display =
                    this.isAdmin()
                        ? ""
                        : "none";
            }
        );
    }

    /* =====================================================
       ROUTER
    ===================================================== */

    navigateTo(viewId) {

        if (
            !this.state.currentUser &&
            viewId !== "auth"
        ) {

            alert(
                "Please login first."
            );

            return;
        }

        if (
            viewId === "admin" &&
            !this.isAdmin()
        ) {

            alert(
                "SECURITY ERROR: Admin access denied."
            );

            return;
        }

        document
            .querySelectorAll(
                ".app-view"
            )
            .forEach(view => {
                view.style.display =
                    "none";
            });

        document
            .querySelectorAll(
                ".nav-item"
            )
            .forEach(item => {
                item.classList.remove(
                    "active"
                );
            });

        const target =
            document.getElementById(
                `view-${viewId}`
            );

        if (!target) {

            console.warn(
                `View not found: view-${viewId}`
            );

            return;
        }

        target.style.display =
            "block";

        this.state.activeView =
            viewId;

        const activeNav =
            document.querySelector(
                `.nav-item[data-view="${viewId}"]`
            );

        if (activeNav) {
            activeNav.classList.add(
                "active"
            );
        }

        if (
            viewId === "dashboard"
        ) {

            this.initMap();

            this.loadRequests();
        }

        if (
            viewId === "resources"
        ) {

            this.ensureLocationControls();

            this.refreshResourcesView();
        }

        if (
            viewId === "admin"
        ) {

            this.refreshAdminView();
        }

        if (
            viewId === "profile"
        ) {

            this.loadProfile();
        }
    }

    /* =====================================================
       RESOURCES
    ===================================================== */

    async loadResources() {

        try {

            const data =
                await apiRequest(
                    "/resources"
                );

            this.state.resources =
                Array.isArray(
                    data.resources
                )
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

        this.ensureLocationControls();

        Components.renderCategories(
            this.state.categories,
            this.state.selectedCategory
        );

        try {

            await this.loadResources();

        } catch (error) {

            alert(
                "Unable to load emergency resources."
            );
        }
    }

    async setCategory(
        category
    ) {

        this.state.selectedCategory =
            category ||
            "All";

        Components.renderCategories(
            this.state.categories,
            this.state.selectedCategory
        );

        this.applyFilters();
    }

    applyFilters() {

        let resources =
            [...this.state.resources];

        /* Search */
        if (
            this.state.searchQuery
        ) {

            const search =
                this.state.searchQuery;

            resources =
                resources.filter(
                    resource => {

                        const name =
                            String(
                                resource.name ||
                                ""
                            ).toLowerCase();

                        const description =
                            String(
                                resource.description ||
                                ""
                            ).toLowerCase();

                        const address =
                            String(
                                resource.address ||
                                ""
                            ).toLowerCase();

                        const category =
                            String(
                                resource.category ||
                                ""
                            ).toLowerCase();

                        return (
                            name.includes(search) ||
                            description.includes(search) ||
                            address.includes(search) ||
                            category.includes(search)
                        );
                    }
                );
        }

        /* Category */
        if (
            this.state.selectedCategory !==
            "All"
        ) {

            resources =
                resources.filter(
                    resource =>
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

        /* =================================================
           25 KM LOCATION FILTER
        ================================================= */

        if (userLocation) {

            resources =
                resources
                    .map(resource => {

                        const coordinates =
                            getResourceCoordinates(
                                resource
                            );

                        if (
                            !coordinates
                        ) {

                            return {
                                ...resource,
                                distanceKm:
                                    Infinity
                            };
                        }

                        const distance =
                            calculateDistanceKm(
                                userLocation.latitude,
                                userLocation.longitude,
                                coordinates.latitude,
                                coordinates.longitude
                            );

                        return {
                            ...resource,
                            distanceKm:
                                distance
                        };
                    })
                    .filter(
                        resource =>
                            resource.distanceKm <=
                            25
                    )
                    .sort(
                        (a, b) =>
                            a.distanceKm -
                            b.distanceKm
                    );
        }

        Components.renderResourceTable(
            resources
        );
    }

    /* =====================================================
       MAP
    ===================================================== */

    initMap() {

        const mapElement =
            document.getElementById(
                "map"
            );

        if (!mapElement) {
            return;
        }

        if (
            typeof L ===
            "undefined"
        ) {

            console.error(
                "Leaflet is not loaded."
            );

            return;
        }

        if (!this.map) {

            this.map =
                L.map(
                    mapElement
                ).setView(
                    [
                        19.0760,
                        72.8777
                    ],
                    12
                );

            L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    attribution:
                        "&copy; OpenStreetMap contributors"
                }
            ).addTo(
                this.map
            );
        }

        setTimeout(
            () => {

                if (this.map) {

                    this.map.invalidateSize();

                    this.renderMapMarkers();

                    this.updateLocationMarker();
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

                try {
                    this.map.removeLayer(
                        marker
                    );
                } catch {}
            }
        );

        this.mapMarkers = [];

        this.state.resources.forEach(
            resource => {

                const coordinates =
                    getResourceCoordinates(
                        resource
                    );

                if (!coordinates) {
                    return;
                }

                const distance =
                    userLocation
                        ? calculateDistanceKm(
                            userLocation.latitude,
                            userLocation.longitude,
                            coordinates.latitude,
                            coordinates.longitude
                        )
                        : null;

                const marker =
                    L.marker(
                        [
                            coordinates.latitude,
                            coordinates.longitude
                        ]
                    )
                    .addTo(
                        this.map
                    )
                    .bindPopup(
                        `
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

                            📞
                            ${
                                resource.contact_number ||
                                resource.contactNumber
                                    ? `
                                        <a
                                            href="tel:${escapeHtml(
                                                resource.contact_number ||
                                                resource.contactNumber
                                            )}"
                                        >
                                            ${escapeHtml(
                                                resource.contact_number ||
                                                resource.contactNumber
                                            )}
                                        </a>
                                    `
                                    : "-"
                            }

                            <br>

                            ${escapeHtml(
                                resource.address ||
                                ""
                            )}

                            ${
                                distance !== null
                                    ? `
                                        <br>
                                        📍
                                        ${distance.toFixed(
                                            1
                                        )} km away
                                    `
                                    : ""
                            }
                        `
                    );

                this.mapMarkers.push(
                    marker
                );
            }
        );

        this.updateLocationMarker();
    }

    routeTo(
        lat,
        lng
    ) {

        lat = Number(lat);
        lng = Number(lng);

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng)
        ) {

            alert(
                "This resource does not have valid coordinates."
            );

            return;
        }

        this.navigateTo(
            "dashboard"
        );

        setTimeout(
            () => {

                if (this.map) {

                    this.map.setView(
                        [
                            lat,
                            lng
                        ],
                        16
                    );

                    this.map.invalidateSize();
                }

            },
            300
        );
    }

    /* =====================================================
       SOS
    ===================================================== */

    async triggerSos() {

        if (
            !this.state.currentUser
        ) {

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
                "Unable to load emergency resources."
            );

            return;
        }

        let ambulances =
            this.state.resources.filter(
                resource => {

                    const category =
                        String(
                            resource.category ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    const name =
                        String(
                            resource.name ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    return (
                        category ===
                        "ambulance" ||
                        name.includes(
                            "ambulance"
                        )
                    );
                }
            );

        if (
            ambulances.length === 0
        ) {

            alert(
                "No ambulance resource available.\n\n" +
                "Admin Panel → Add Resource → Category: Ambulance"
            );

            return;
        }

        /* Nearest ambulance */
        if (userLocation) {

            ambulances =
                ambulances
                    .map(
                        ambulance => {

                            const coordinates =
                                getResourceCoordinates(
                                    ambulance
                                );

                            if (!coordinates) {

                                return {
                                    ...ambulance,
                                    distanceKm:
                                        Infinity
                                };
                            }

                            return {
                                ...ambulance,

                                distanceKm:
                                    calculateDistanceKm(
                                        userLocation.latitude,
                                        userLocation.longitude,
                                        coordinates.latitude,
                                        coordinates.longitude
                                    )
                            };
                        }
                    )
                    .sort(
                        (a, b) =>
                            a.distanceKm -
                            b.distanceKm
                    );
        }

        const ambulance =
            ambulances[0];

        console.log(
            "Ambulance selected for SOS:",
            ambulance
        );

        const confirmed =
            confirm(
                `Are you sure you want to dispatch an emergency SOS?\n\nAmbulance: ${ambulance.name}`
            );

        if (!confirmed) {
            return;
        }

        try {

            const data =
                await apiRequest(
                    "/requests",
                    {
                        method: "POST",

                        body:
                            JSON.stringify({

                                resourceId:
                                    Number(
                                        ambulance.id
                                    ),

                                serviceType:
                                    "User SOS Alert",

                                phoneNumber:
                                    this.state.currentUser.phone ||
                                    null
                            })
                    }
                );

            const requestId =
                data.id ||
                data.requestId ||
                "";

            alert(
                `SOS DISPATCHED!\n\n` +
                `Request #${requestId}\n\n` +
                `Ambulance: ${ambulance.name}\n\n` +
                `Status: Pending\n\n` +
                `You will be notified when the request status changes.`
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

    /* =====================================================
       REQUEST SERVICE
    ===================================================== */

    async requestService(
        resourceId
    ) {

        if (
            !this.state.currentUser
        ) {

            alert(
                "Please login first."
            );

            return;
        }

        let resource =
            this.state.resources.find(
                item =>
                    Number(item.id) ===
                    Number(resourceId)
            );

        if (!resource) {

            try {

                await this.loadResources();

                resource =
                    this.state.resources.find(
                        item =>
                            Number(item.id) ===
                            Number(resourceId)
                    );

            } catch {

                resource = null;
            }
        }

        if (!resource) {

            alert(
                "Resource not found."
            );

            return;
        }

        const confirmed =
            confirm(
                `Send emergency request to ${resource.name}?`
            );

        if (!confirmed) {
            return;
        }

        const category =
            String(
                resource.category ||
                ""
            ).trim();

        const serviceType =
            category.toLowerCase() ===
            "ambulance"
                ? "Ambulance Assistance"
                : `${category} Emergency Assistance`;

        try {

            const data =
                await apiRequest(
                    "/requests",
                    {
                        method: "POST",

                        body:
                            JSON.stringify({

                                resourceId:
                                    Number(
                                        resource.id
                                    ),

                                serviceType,

                                phoneNumber:
                                    this.state.currentUser.phone ||
                                    null
                            })
                    }
                );

            const requestId =
                data.id ||
                data.requestId ||
                "";

            alert(
                `Emergency request created.\n\n` +
                `Request #${requestId}\n\n` +
                `Status: Pending\n\n` +
                `You will be notified when the request status changes.`
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

    /* =====================================================
       REQUESTS
    ===================================================== */

    async loadRequests() {

        try {

            const data =
                await apiRequest(
                    "/requests"
                );

            this.state.requests =
                Array.isArray(
                    data.requests
                )
                    ? data.requests
                    : [];

            Components.renderIncidents(
                this.state.requests,
                this.isAdmin()
            );

            this.checkRequestStatusChanges(
                this.state.requests
            );

        } catch (error) {

            console.error(
                "Request loading error:",
                error
            );
        }
    }

    /* =====================================================
       REQUEST STATUS NOTIFICATIONS
    ===================================================== */

    startRequestPolling() {

        if (
            this.requestPollTimer
        ) {

            clearInterval(
                this.requestPollTimer
            );
        }

        if (
            !this.state.currentUser
        ) {
            return;
        }

        this.requestPollTimer =
            setInterval(
                async () => {

                    if (
                        !this.state.currentUser
                    ) {
                        return;
                    }

                    await this.loadRequests();

                },
                5000
            );
    }

    checkRequestStatusChanges(
        requests
    ) {

        if (
            !Array.isArray(requests)
        ) {
            return;
        }

        requests.forEach(
            request => {

                const id =
                    String(
                        request.id
                    );

                const status =
                    String(
                        request.status ||
                        "Pending"
                    );

                const oldStatus =
                    requestStatusSnapshot[
                        id
                    ];

                if (
                    oldStatus &&
                    oldStatus !== status
                ) {

                    if (
                        status ===
                        "Accepted"
                    ) {

                        alert(
                            `Emergency Request #${id}\n\nACCEPTED\n\nYour emergency request has been accepted. Please keep your phone available.`
                        );
                    }

                    else if (
                        status ===
                        "Resolved"
                    ) {

                        alert(
                            `Emergency Request #${id}\n\nRESOLVED\n\nYour emergency request has been resolved.`
                        );
                    }

                    else if (
                        status ===
                        "Cancelled"
                    ) {

                        alert(
                            `Emergency Request #${id}\n\nCANCELLED\n\nYour emergency request has been cancelled.`
                        );
                    }
                }

                requestStatusSnapshot[
                    id
                ] = status;
            }
        );
    }

    /* =====================================================
       ALERTS
    ===================================================== */

    async loadAlerts() {

        try {

            const data =
                await apiRequest(
                    "/alerts"
                );

            this.state.alerts =
                Array.isArray(
                    data.alerts
                )
                    ? data.alerts
                    : [];

            Components.renderAlerts(
                this.state.alerts
            );

        } catch (error) {

            console.error(
                "Alert loading error:",
                error
            );
        }
    }

    /* =====================================================
       PROFILE
    ===================================================== */

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
                .getElementById(
                    "profName"
                )
                ?.value.trim();

        const phone =
            document
                .getElementById(
                    "profPhone"
                )
                ?.value.trim();

        if (!name) {

            alert(
                "Name is required."
            );

            return;
        }

        try {

            const data =
                await apiRequest(
                    "/auth/profile",
                    {
                        method: "PUT",

                        body:
                            JSON.stringify({
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

    /* =====================================================
       ADMIN PANEL
    ===================================================== */

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
                Array.isArray(
                    data.resources
                )
                    ? data.resources
                    : [];

            Components.renderAdminResourceTable(
                this.state.resources
            );

        } catch (error) {

            console.error(
                "Admin resource loading error:",
                error
            );

            alert(
                error.message
            );
        }

        if (
            typeof window.loadAdminServiceRequests ===
            "function"
        ) {

            await window.loadAdminServiceRequests();
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
                        <option
                            value="${escapeHtml(
                                category.name
                            )}"
                        >
                            ${escapeHtml(
                                category.name
                            )}
                        </option>
                    `
                )
                .join("");
    }

    /* =====================================================
       ADMIN SAVE RESOURCE
    ===================================================== */

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
                ?.value.trim();

        const name =
            document
                .getElementById(
                    "admResName"
                )
                ?.value.trim();

        const category =
            document
                .getElementById(
                    "admResCategory"
                )
                ?.value.trim();

        const contact =
            document
                .getElementById(
                    "admResContact"
                )
                ?.value.trim();

        const address =
            document
                .getElementById(
                    "admResAddress"
                )
                ?.value.trim();

        const latInput =
            document
                .getElementById(
                    "admResLat"
                )
                ?.value.trim();

        const lngInput =
            document
                .getElementById(
                    "admResLng"
                )
                ?.value.trim();

        let latitude =
            latInput === ""
                ? null
                : parseFloat(
                    latInput
                );

        let longitude =
            lngInput === ""
                ? null
                : parseFloat(
                    lngInput
                );

        if (
            !name ||
            !category ||
            !address
        ) {

            alert(
                "Name, category and address are required."
            );

            return;
        }

        if (
            latitude !== null &&
            !Number.isFinite(latitude)
        ) {

            alert(
                "Latitude must be a valid number."
            );

            return;
        }

        if (
            longitude !== null &&
            !Number.isFinite(longitude)
        ) {

            alert(
                "Longitude must be a valid number."
            );

            return;
        }

        const payload = {

            name,

            description:
                `${category} emergency resource`,

            category,

            address,

            latitude,

            longitude,

            contactNumber:
                contact ||
                null,

            workingHours:
                "24/7"
        };

        try {

            let data;

            if (editId) {

                data =
                    await apiRequest(
                        `/resources/${encodeURIComponent(
                            editId
                        )}`,
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
                        ? "Resource updated successfully."
                        : "Resource added successfully."
                )
            );

            this.resetAdminForm();

            await this.loadResources();

            await this.refreshAdminView();

        } catch (error) {

            console.error(
                "Admin resource save error:",
                error
            );

            alert(
                error.message
            );
        }
    }

    /* =====================================================
       EDIT RESOURCE
    ===================================================== */

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

            const resources =
                Array.isArray(
                    data.resources
                )
                    ? data.resources
                    : [];

            const resource =
                resources.find(
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

            this.populateAdminFormOptions();

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

                const resourceCategory =
                    resource.category ||
                    "";

                const hasOption =
                    Array.from(
                        categoryField.options
                    ).some(
                        option =>
                            option.value ===
                            resourceCategory
                    );

                if (
                    !hasOption &&
                    resourceCategory
                ) {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        resourceCategory;

                    option.textContent =
                        resourceCategory;

                    categoryField.appendChild(
                        option
                    );
                }

                categoryField.value =
                    resourceCategory;
            }

            if (contactField) {

                contactField.value =
                    resource.contact_number ||
                    resource.contactNumber ||
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

            const adminView =
                document.getElementById(
                    "view-admin"
                );

            if (adminView) {

                adminView.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }

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

    /* =====================================================
       DELETE RESOURCE
    ===================================================== */

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
                    `/resources/${encodeURIComponent(
                        id
                    )}`,
                    {
                        method: "DELETE"
                    }
                );

            alert(
                data.message ||
                "Resource deleted successfully."
            );

            const currentEditId =
                document
                    .getElementById(
                        "admResId"
                    )
                    ?.value;

            if (
                String(currentEditId) ===
                String(id)
            ) {

                this.resetAdminForm();
            }

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

    /* =====================================================
       RESET ADMIN FORM
    ===================================================== */

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

        this.populateAdminFormOptions();
    }

    /* =====================================================
       ADMIN BROADCAST ALERT
    ===================================================== */

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
                "Please enter a broadcast message."
            );

            return;
        }

        try {

            const data =
                await apiRequest(
                    "/alerts",
                    {
                        method: "POST",

                        body:
                            JSON.stringify({
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
}

/* =========================================================
   START APPLICATION
========================================================= */

window.addEventListener(
    "DOMContentLoaded",
    () => {

        window.app =
            new Application();

    }
);

/* =========================================================
   RESQGO - ADMIN SERVICE REQUEST MANAGEMENT
========================================================= */

(function () {

    function escapeAdminText(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function createAdminRequestContainer() {

        const adminView =
            document.getElementById(
                "view-admin"
            );

        if (!adminView) {
            return null;
        }

        let container =
            document.getElementById(
                "adminServiceRequestsContainer"
            );

        if (!container) {

            container =
                document.createElement(
                    "div"
                );

            container.id =
                "adminServiceRequestsContainer";

            container.style.marginTop =
                "25px";

            adminView.appendChild(
                container
            );
        }

        return container;
    }

    function renderAdminRequests(
        requests
    ) {

        const container =
            createAdminRequestContainer();

        if (!container) {
            return;
        }

        if (
            !Array.isArray(requests) ||
            requests.length === 0
        ) {

            container.innerHTML = `

                <div class="admin-card">

                    <h3>
                        Manage Service Requests
                    </h3>

                    <p>
                        No service requests found.
                    </p>

                </div>

            `;

            return;
        }

        let rows = "";

        requests.forEach(
            function (request) {

                const id =
                    Number(
                        request.id ||
                        0
                    );

                const userName =
                    request.user_name ||
                    request.userName ||
                    request.name ||
                    "User";

                const resourceName =
                    request.resource_name ||
                    request.resourceName ||
                    request.resource ||
                    "Emergency Resource";

                const requestType =
                    request.request_type ||
                    request.requestType ||
                    request.service_type ||
                    request.serviceType ||
                    request.description ||
                    "Emergency Assistance";

                const phone =
                    request.phone ||
                    request.phone_number ||
                    request.contact ||
                    "-";

                const status =
                    request.status ||
                    "Pending";

                rows += `

                    <tr>

                        <td>
                            ${escapeAdminText(id)}
                        </td>

                        <td>
                            ${escapeAdminText(
                                userName
                            )}
                        </td>

                        <td>
                            ${escapeAdminText(
                                resourceName
                            )}
                        </td>

                        <td>
                            ${escapeAdminText(
                                requestType
                            )}
                        </td>

                        <td>
                            ${escapeAdminText(
                                phone
                            )}
                        </td>

                        <td>
                            <strong>
                                ${escapeAdminText(
                                    status
                                )}
                            </strong>
                        </td>

                        <td>

                            <select
                                class="admin-request-status"
                                data-request-id="${id}"
                            >

                                <option
                                    value="Pending"
                                    ${
                                        status ===
                                        "Pending"
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Pending
                                </option>

                                <option
                                    value="Accepted"
                                    ${
                                        status ===
                                        "Accepted"
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Accepted
                                </option>

                                <option
                                    value="Resolved"
                                    ${
                                        status ===
                                        "Resolved"
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Resolved
                                </option>

                                <option
                                    value="Cancelled"
                                    ${
                                        status ===
                                        "Cancelled"
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Cancelled
                                </option>

                            </select>

                        </td>

                    </tr>

                `;
            }
        );

        container.innerHTML = `

            <div class="admin-card">

                <h3>
                    Manage Service Requests
                </h3>

                <div
                    style="overflow-x:auto;"
                >

                    <table
                        style="
                            width:100%;
                            border-collapse:collapse;
                        "
                    >

                        <thead>

                            <tr>

                                <th
                                    style="
                                        padding:10px;
                                        text-align:left;
                                    "
                                >
                                    ID
                                </th>

                                <th
                                    style="
                                        padding:10px;
                                        text-align:left;
                                    "
                                >
                                    User
                                </th>

                                <th
                                    style="
                                        padding:10px;
                                        text-align:left;
                                    "
                                >
                                    Resource
                                </th>

                                <th
                                    style="
                                        padding:10px;
                                        text-align:left;
                                    "
                                >
                                    Request
                                </th>

                                <th
                                    style="
                                        padding:10px;
                                        text-align:left;
                                    "
                                >
                                    Phone
                                </th>

                                <th
                                    style="
                                        padding:10px;
                                        text-align:left;
                                    "
                                >
                                    Status
                                </th>

                                <th
                                    style="
                                        padding:10px;
                                        text-align:left;
                                    "
                                >
                                    Update
                                </th>

                            </tr>

                        </thead>

                        <tbody>

                            ${rows}

                        </tbody>

                    </table>

                </div>

            </div>

        `;

        const selects =
            container.querySelectorAll(
                ".admin-request-status"
            );

        selects.forEach(
            function (select) {

                select.addEventListener(
                    "change",
                    async function () {

                        const requestId =
                            Number(
                                this.dataset
                                    .requestId
                            );

                        const newStatus =
                            this.value;

                        try {

                            const result =
                                await apiRequest(
                                    `/admin/requests/${requestId}/status`,
                                    {
                                        method: "PUT",

                                        body:
                                            JSON.stringify({
                                                status:
                                                    newStatus
                                            })
                                    }
                                );

                            alert(
                                result.message ||
                                "Request status updated successfully."
                            );

                            await loadAdminServiceRequests();

                            if (
                                window.app &&
                                typeof window.app.loadRequests ===
                                "function"
                            ) {

                                await window.app.loadRequests();
                            }

                        } catch (error) {

                            console.error(
                                "Request status update error:",
                                error
                            );

                            alert(
                                error.message ||
                                "Failed to update request status."
                            );

                            await loadAdminServiceRequests();
                        }

                    }
                );

            }
        );
    }

    async function loadAdminServiceRequests() {

        const container =
            createAdminRequestContainer();

        if (!container) {
            return;
        }

        container.innerHTML = `

            <div class="admin-card">

                <h3>
                    Manage Service Requests
                </h3>

                <p>
                    Loading service requests...
                </p>

            </div>

        `;

        try {

            const data =
                await apiRequest(
                    "/admin/requests"
                );

            const requests =
                Array.isArray(data)
                    ? data
                    : (
                        Array.isArray(
                            data.requests
                        )
                            ? data.requests
                            : []
                    );

            renderAdminRequests(
                requests
            );

        } catch (error) {

            console.error(
                "Admin service request loading error:",
                error
            );

            container.innerHTML = `

                <div class="admin-card">

                    <h3>
                        Manage Service Requests
                    </h3>

                    <p>
                        Unable to load service requests.
                    </p>

                </div>

            `;
        }
    }

    window.loadAdminServiceRequests =
        loadAdminServiceRequests;

})();