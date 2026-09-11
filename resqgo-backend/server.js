require("dotenv").config(); 
 
const express = require("express"); 
const mysql = require("mysql2/promise"); 
const bcrypt = require("bcryptjs"); 
const jwt = require("jsonwebtoken"); 
const path = require("path"); 
/*
 * =====================================================
 * RESEND EMAIL NOTIFICATION
 * =====================================================
 */

async function sendResendEmail(to, subject, html) {

    try {

        if (!process.env.RESEND_API_KEY) {

            console.error(
                "RESEND_API_KEY is missing"
            );

            return false;
        }

        const response = await fetch(
            "https://api.resend.com/emails",
            {
                method: "POST",

                headers: {
                    "Authorization":
                        `Bearer ${process.env.RESEND_API_KEY}`,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    from:
                        process.env.RESEND_FROM_EMAIL ||
                        "onboarding@resend.dev",

                    to: [to],

                    subject: subject,

                    html: html
                })
            }
        );

        const data =
            await response.json();

        if (!response.ok) {

            console.error(
                "Resend email error:",
                data
            );

            return false;
        }

        console.log(
            "Resend email sent successfully:",
            data
        );

        return true;

    } catch (error) {

        console.error(
            "Email sending error:",
            error
        );

        return false;
    }
}
 
const app = express(); 
 
app.use(express.json()); 
/*
 * =====================================================
 * CORS SUPPORT FOR DIRECT index.html OPENING
 * =====================================================
 */

app.use((req, res, next) => {

    res.header(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.header(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,DELETE,OPTIONS"
    );

    res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use(express.static(path.join(__dirname, ".."))); 
 
 
// ===================================================== 
// MYSQL CONNECTION 
// ===================================================== 
 
const pool = mysql.createPool({ 
    host: process.env.DB_HOST, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME, 
    waitForConnections: true, 
    connectionLimit: 10 
}); 
/*
 * =====================================================
 * INDIA LOCATION GEOCODING
 * =====================================================
 */

let lastGeocodeTime = 0;

async function geocodeIndia(query) {

    if (!query || !query.trim()) {
        return null;
    }

    const now = Date.now();

    const waitTime =
        1100 - (now - lastGeocodeTime);

    if (waitTime > 0) {
        await new Promise(resolve =>
            setTimeout(resolve, waitTime)
        );
    }

    lastGeocodeTime = Date.now();

    try {

        const url =
            "https://nominatim.openstreetmap.org/search" +
            `?q=${encodeURIComponent(query.trim())}` +
            "&format=json" +
            "&limit=1" +
            "&countrycodes=in" +
            "&addressdetails=1";

        const response = await fetch(
            url,
            {
                headers: {
                    "User-Agent":
                        "ResQGo Emergency Resource Locator/1.0"
                }
            }
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        if (!data || data.length === 0) {
            return null;
        }

        return {
            latitude: Number(data[0].lat),
            longitude: Number(data[0].lon),
            displayName: data[0].display_name
        };

    } catch (error) {

        console.error(
            "Geocoding error:",
            error
        );

        return null;
    }
}
 
 
// ===================================================== 
// AUTHENTICATION 
// ===================================================== 
 
function authenticate(req, res, next) { 
 
    try { 
 
        const header = req.headers.authorization; 
 
        if (!header || !header.startsWith("Bearer ")) { 
            return res.status(401).json({ 
                message: "Please login first" 
            }); 
        } 
 
        const token = header.split(" ")[1]; 
 
        const decoded = jwt.verify( 
            token, 
            process.env.JWT_SECRET 
        ); 
 
        req.user = decoded; 
 
        next(); 
 
    } catch (error) { 
 
        return res.status(401).json({ 
            message: "Invalid or expired token" 
        }); 
 
    } 
} 
 
 
function adminOnly(req, res, next) { 
 
    if (req.user.role !== "admin") { 
 
        return res.status(403).json({ 
            message: "Admin access required" 
        }); 
 
    } 
 
    next(); 
} 
 
 
// ===================================================== 
// REGISTER 
// ===================================================== 
 
app.post("/api/auth/register", async (req, res) => { 
 
    try { 
 
        const { 
            name, 
            email, 
            phone, 
            password 
        } = req.body; 
 
        if (!name || !email || !password) { 
 
            return res.status(400).json({ 
                message: "Name, email and password are required" 
            }); 
 
        } 
 
        const [existing] = await pool.execute( 
            "SELECT id FROM users WHERE email = ?", 
            [email] 
        ); 
 
        if (existing.length > 0) { 
 
            return res.status(400).json({ 
                message: "Email already registered" 
            }); 
 
        } 
 
        const hashedPassword = 
            await bcrypt.hash(password, 10); 
 
        const [result] = await pool.execute( 
            `INSERT INTO users 
            (name, email, phone, password, role) 
            VALUES (?, ?, ?, ?, ?)`, 
            [ 
                name, 
                email, 
                phone || null, 
                hashedPassword, 
                "user" 
            ] 
        ); 
 
        const user = { 
            id: result.insertId, 
            name, 
            email, 
            phone: phone || null, 
            role: "user" 
        }; 
 
        const token = jwt.sign( 
            user, 
            process.env.JWT_SECRET, 
            { 
                expiresIn: "2h" 
            } 
        ); 
 
        res.status(201).json({ 
            message: "Registration successful", 
            token, 
            user 
        }); 
 
    } catch (error) { 
 
        console.error(error); 
 
        res.status(500).json({ 
            message: "Registration failed" 
        }); 
 
    } 
 
}); 
 
 
// ===================================================== 
// LOGIN 
// ===================================================== 
 
app.post("/api/auth/login", async (req, res) => { 
 
    try { 
 
        const { 
            email, 
            password 
        } = req.body; 
 
        if (!email || !password) { 
 
            return res.status(400).json({ 
                message: "Email and password are required" 
            }); 
 
        } 
 
        const [rows] = await pool.execute( 
            "SELECT * FROM users WHERE email = ?", 
            [email] 
        ); 
 
        if (rows.length === 0) { 
 
            return res.status(401).json({ 
                message: "Invalid email or password" 
            }); 
 
        } 
 
        const user = rows[0]; 
 
        const validPassword = 
            await bcrypt.compare( 
                password, 
                user.password 
            ); 
 
        if (!validPassword) { 
 
            return res.status(401).json({ 
                message: "Invalid email or password" 
            }); 
 
        } 
 
        const safeUser = { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            phone: user.phone, 
            role: user.role 
        }; 
 
        const token = jwt.sign( 
            safeUser, 
            process.env.JWT_SECRET, 
            { 
                expiresIn: "2h" 
            } 
        ); 
 
        res.json({ 
            message: "Login successful", 
            token, 
            user: safeUser 
        }); 
 
    } catch (error) { 
 
        console.error(error); 
 
        res.status(500).json({ 
            message: "Login failed" 
        }); 
 
    } 
 
}); 
 
 
// ===================================================== 
// CURRENT USER 
// ===================================================== 
 
app.get( 
    "/api/auth/me", 
    authenticate, 
    async (req, res) => { 
 
        try { 
 
            const [rows] = await pool.execute( 
                `SELECT id, name, email, phone, role 
                 FROM users 
                 WHERE id = ?`, 
                [req.user.id] 
            ); 
 
            if (rows.length === 0) { 
 
                return res.status(404).json({ 
                    message: "User not found" 
                }); 
 
            } 
 
            res.json({ 
                user: rows[0] 
            }); 
 
        } catch (error) { 
 
            console.error(error); 
 
            res.status(500).json({ 
                message: "Unable to get user" 
            }); 
 
        } 
 
    } 
); 
 
 
// ===================================================== 
// UPDATE PROFILE 
// ===================================================== 
 
app.put( 
    "/api/auth/profile", 
    authenticate, 
    async (req, res) => { 
 
        try { 
 
            const { 
                name, 
                phone 
            } = req.body; 
 
            if (!name) { 
 
                return res.status(400).json({ 
                    message: "Name is required" 
                }); 
 
            } 
 
            await pool.execute( 
                `UPDATE users 
                 SET name = ?, phone = ? 
                 WHERE id = ?`, 
                [ 
                    name, 
                    phone || null, 
                    req.user.id 
                ] 
            ); 
 
            const [rows] = await pool.execute( 
                `SELECT id, name, email, phone, role 
                 FROM users 
                 WHERE id = ?`, 
                [req.user.id] 
            ); 
 
            res.json({ 
                message: "Profile updated successfully", 
                user: rows[0] 
            }); 
 
        } catch (error) { 
 
            console.error(error); 
 
            res.status(500).json({ 
                message: "Unable to update profile" 
            }); 
 
        } 
 
    } 
); 
 
 /*
 * =====================================================
 * FIND LOCATION IN INDIA
 * =====================================================
 */

/*
 * =====================================================
 * FIND LOCATION IN INDIA
 * =====================================================
 */

app.get(
    "/api/geocode",
    authenticate,
    async (req, res) => {

        try {

            const q =
                req.query.q || "";

            if (!q.trim()) {

                return res.status(400).json({
                    message:
                        "Location search is required"
                });
            }

            /*
             * First search ResQGo database.
             * Each search word can match the resource
             * name, category, address or description.
             */
            const searchWords =
                q
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean);

            const conditions = [];
            const values = [];

            searchWords.forEach(word => {

                conditions.push(`
                    (
                        name LIKE ?
                        OR category LIKE ?
                        OR address LIKE ?
                        OR description LIKE ?
                    )
                `);

                const value =
                    `%${word}%`;

                values.push(
                    value,
                    value,
                    value,
                    value
                );
            });

            const resourceSql = `
                SELECT
                    id,
                    name,
                    category,
                    address,
                    latitude,
                    longitude,
                    description
                FROM resources
                WHERE
                    ${conditions.join(" AND ")}
                    AND latitude IS NOT NULL
                    AND longitude IS NOT NULL
                ORDER BY name ASC
                LIMIT 1
            `;

            const [resources] =
                await pool.execute(
                    resourceSql,
                    values
                );

            /*
             * If ResQGo resource is found,
             * return its saved coordinates.
             */
            if (resources.length > 0) {

                const resource =
                    resources[0];

                return res.json({
                    latitude:
                        Number(resource.latitude),

                    longitude:
                        Number(resource.longitude),

                    display_name:
                        `${resource.name}, ${resource.address}`
                });
            }

            /*
             * If resource is not in our database,
             * search OpenStreetMap.
             */
            const location =
                await geocodeIndia(q);

            if (!location) {

                return res.status(404).json({
                    message:
                        "Location not found in India"
                });
            }

            res.json({
                latitude:
                    location.latitude,

                longitude:
                    location.longitude,

                display_name:
                    location.displayName
            });

        } catch (error) {

            console.error(
                "Location search error:",
                error
            );

            res.status(500).json({
                message:
                    "Unable to find location"
            });
        }
    }
);

// ===================================================== 
// GET RESOURCES 
// ===================================================== 
 
app.get("/api/resources", async (req, res) => { 
 
    try { 
 
        const search = req.query.search || ""; 
        const category = req.query.category || ""; 
 
        let sql = ` 
            SELECT * 
            FROM resources 
            WHERE 1=1 
        `; 
 
        const values = []; 
 
        if (search) { 
 
            sql += ` 
                AND ( 
                    name LIKE ? 
                    OR description LIKE ? 
                    OR address LIKE ? 
                ) 
            `; 
 
            const searchValue = `%${search}%`; 
 
            values.push( 
                searchValue, 
                searchValue, 
                searchValue 
            ); 
 
        } 
 
        if (category) { 
 
            sql += ` 
                AND category = ? 
            `; 
 
            values.push(category); 
 
        } 
 
        sql += ` 
            ORDER BY name ASC 
        `; 
 
        const [rows] = 
            await pool.execute(sql, values); 
 
        res.json({ 
            resources: rows 
        }); 
 
    } catch (error) { 
 
        console.error(error); 
 
        res.status(500).json({ 
            message: "Unable to load resources" 
        }); 
 
    } 
 
}); 
 
 
// ===================================================== 
// ADD RESOURCE - ADMIN 
// ===================================================== 
 
app.post( 
    "/api/resources", 
    authenticate, 
    adminOnly, 
    async (req, res) => { 
 
        try { 
 
            let {
    name,
    description,
    category,
    address,
    latitude,
    longitude,
    contactNumber,
    workingHours
} = req.body;
            if (
    !name ||
    !category ||
    !address
) {

    return res.status(400).json({
        message:
            "Name, category and address are required"
    });
}

/*
 * Automatically find coordinates when
 * latitude and longitude are empty.
 */
const missingCoordinates =
    latitude === undefined ||
    latitude === null ||
    latitude === "" ||
    longitude === undefined ||
    longitude === null ||
    longitude === "";

if (missingCoordinates) {

    const location =
        await geocodeIndia(address);

    if (!location) {

        return res.status(400).json({
            message:
                "Unable to locate this address in India. Please provide a more specific city or area."
        });
    }

    latitude =
        location.latitude;

    longitude =
        location.longitude;
}
 
            const [result] = await pool.execute( 
                `INSERT INTO resources 
                ( 
                    name, 
                    description, 
                    category, 
                    address, 
                    latitude, 
                    longitude, 
                    contact_number, 
                    working_hours 
                ) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                [ 
                    name, 
                    description || null, 
                    category, 
                    address, 
                    latitude, 
                    longitude, 
                    contactNumber || null, 
                    workingHours || "24/7" 
                ] 
            ); 
 
            res.status(201).json({ 
                message: "Resource added successfully", 
                id: result.insertId 
            }); 
 
        } catch (error) { 
 
            console.error(error); 
 
            res.status(500).json({ 
                message: "Unable to add resource" 
            }); 
 
        } 
 
    } 
); 
 
 
// ===================================================== 
// UPDATE RESOURCE - ADMIN 
// ===================================================== 
 
app.put( 
    "/api/resources/:id", 
    authenticate, 
    adminOnly, 
    async (req, res) => { 
 
        try { 
 
            const id = req.params.id; 
 
           let {
    name,
    description,
    category,
    address,
    latitude,
    longitude,
    contactNumber,
    workingHours
} = req.body;
 
            if (
    !name ||
    !category ||
    !address
) {

    return res.status(400).json({
        message:
            "Name, category and address are required"
    });
}

/*
 * Automatically find coordinates when
 * latitude and longitude are empty.
 */
const missingCoordinates =
    latitude === undefined ||
    latitude === null ||
    latitude === "" ||
    longitude === undefined ||
    longitude === null ||
    longitude === "";

if (missingCoordinates) {

    const location =
        await geocodeIndia(address);

    if (!location) {

        return res.status(400).json({
            message:
                "Unable to locate this address in India. Please provide a more specific city or area."
        });
    }

    latitude =
        location.latitude;

    longitude =
        location.longitude;
}
            const [result] = await pool.execute( 
                `UPDATE resources 
                 SET 
                    name = ?, 
                    description = ?, 
                    category = ?, 
                    address = ?, 
                    latitude = ?, 
                    longitude = ?, 
                    contact_number = ?, 
                    working_hours = ? 
                 WHERE id = ?`, 
                [ 
                    name, 
                    description || null, 
                    category, 
                    address, 
                    latitude, 
                    longitude, 
                    contactNumber || null, 
                    workingHours || "24/7", 
                    id 
                ] 
            ); 
 
            if (result.affectedRows === 0) { 
 
                return res.status(404).json({ 
                    message: "Resource not found" 
                }); 
 
            } 
            
 
 
            res.json({ 
                message: "Resource updated successfully" 
            }); 
 
        } catch (error) { 
 
            console.error(error); 
 
            res.status(500).json({ 
                message: "Unable to update resource" 
            }); 
 
        } 
 
    } 
); 
 
 
// ===================================================== 
// DELETE RESOURCE - ADMIN 
// ===================================================== 
 
app.delete( 
    "/api/resources/:id", 
    authenticate, 
    adminOnly, 
    async (req, res) => { 
 
        try { 
 
            const [result] = await pool.execute( 
                "DELETE FROM resources WHERE id = ?", 
                [req.params.id] 
            ); 
 
            if (result.affectedRows === 0) { 
 
                return res.status(404).json({ 
                    message: "Resource not found" 
                }); 
 
            } 
 
            res.json({ 
                message: "Resource deleted successfully" 
            }); 
 
        } catch (error) { 
 
            console.error(error); 
 
            res.status(500).json({ 
                message: "Unable to delete resource" 
            }); 
 
        } 
 
    } 
); 
 
 
// ===================================================== 
// CREATE SERVICE REQUEST / SOS 
// ===================================================== 
 
app.post( 
    "/api/requests", 
    authenticate, 
    async (req, res) => { 
 
        try { 
 
            const { 
                resourceId, 
                serviceType, 
                phoneNumber 
            } = req.body; 
 
            if (!resourceId) { 
 
                return res.status(400).json({ 
                    message: "Resource ID is required" 
                }); 
 
            } 
 
            const [resourceRows] = await pool.execute( 
                `SELECT id 
                 FROM resources 
                 WHERE id = ?`, 
                [resourceId] 
            ); 
 
            if (resourceRows.length === 0) { 
 
                return res.status(404).json({ 
                    message: "Resource not found" 
                }); 
 
            } 
 
            const [result] = await pool.execute( 
                `INSERT INTO service_requests 
                ( 
                    user_id, 
                    resource_id, 
                    service_type, 
                    phone_number, 
                    status 
                ) 
                VALUES (?, ?, ?, ?, 'Pending')`, 
                [ 
                    req.user.id, 
                    resourceId, 
                    serviceType || "Emergency assistance", 
                    phoneNumber || null 
                ] 
            ); 
 
            const requestId = result.insertId;

res.status(201).json({

    message:
        `Emergency request #${requestId} created successfully`,

    id: requestId,

    status: "Pending",

    statusMessage:
        "Your emergency request has been received and is currently pending. You will be notified when its status changes."
});
 
        } catch (error) { 
 
            console.error(error); 
 
            res.status(500).json({ 
                message: "Unable to create request" 
            }); 
 
        } 
 
    } 
); 
 
 
// ===================================================== 
// USER REQUESTS 
// ===================================================== 
 
app.get( 
    "/api/requests", 
    authenticate, 
    async (req, res) => { 
 
        try { 
 
            const [rows] = await pool.execute( 
                `SELECT 
                    sr.id, 
                    sr.user_id, 
                    sr.resource_id, 
                    sr.service_type, 
                    sr.phone_number, 
                    sr.status, 
                    sr.requested_at, 
                    r.name AS resource_name, 
                    r.category 
                 FROM service_requests sr 
                 JOIN resources r 
                    ON sr.resource_id = r.id 
                 WHERE sr.user_id = ? 
                 ORDER BY sr.requested_at DESC`, 
                [req.user.id] 
            ); 
 
            res.json({ 
                requests: rows 
            }); 
 
        } catch (error) { 
 
            console.error(error); 
 
            res.status(500).json({ 
                message: "Unable to load requests" 
            }); 
 
        } 
 
    } 
); 
 
 
// ===================================================== 
// ADMIN - GET ALL SERVICE REQUESTS 
// ===================================================== 
 
app.get( 
    "/api/admin/requests", 
    authenticate, 
    adminOnly, 
    async (req, res) => { 
 
        try { 
 
            const [rows] = await pool.execute( 
                `SELECT 
                    sr.id, 
                    sr.user_id, 
                    sr.resource_id, 
                    sr.service_type, 
                    sr.phone_number, 
                    sr.status, 
                    sr.requested_at, 
 
                    u.name AS user_name, 
                    u.email AS user_email, 
 
                    r.name AS resource_name, 
                    r.category AS resource_category 
 
                 FROM service_requests sr 
 
                 LEFT JOIN users u 
                    ON sr.user_id = u.id 
 
                 LEFT JOIN resources r 
                    ON sr.resource_id = r.id 
 
                 ORDER BY sr.requested_at DESC` 
            ); 
 
            res.json({ 
                requests: rows 
            }); 
 
        } catch (error) { 
 
            console.error(error); 
 
            res.status(500).json({ 
                message: "Unable to load admin requests" 
            }); 
 
        } 
 
    } 
); 
 
 
// ===================================================== 
// ADMIN - UPDATE REQUEST STATUS 
// ===================================================== 
 
app.put( 
    "/api/admin/requests/:id/status", 
    authenticate, 
    adminOnly, 
    async (req, res) => { 
 
        try { 
 
            const requestId = 
                Number(req.params.id); 
 
            const { 
                status 
            } = req.body; 
 
            const allowedStatuses = [ 
                "Pending", 
                "Accepted", 
                "Resolved", 
                "Cancelled" 
            ]; 
 
            if ( 
                !allowedStatuses.includes(status) 
            ) { 
 
                return res.status(400).json({ 
                    message: 
                        "Invalid status. Use Pending, Accepted, Resolved or Cancelled." 
                }); 
 
            } 
            const [requestRows] = await pool.execute(
    `SELECT
        sr.id,
        sr.service_type,
        u.name AS user_name,
        u.email AS user_email,
        r.name AS resource_name
     FROM service_requests sr
     LEFT JOIN users u
        ON sr.user_id = u.id
     LEFT JOIN resources r
        ON sr.resource_id = r.id
     WHERE sr.id = ?`,
    [requestId]
);

if (requestRows.length === 0) {

    return res.status(404).json({
        message: "Request not found"
    });

}

const requestInfo = requestRows[0];
 
            const [result] = await pool.execute( 
                `UPDATE service_requests 
                 SET status = ? 
                 WHERE id = ?`, 
                [ 
                    status, 
                    requestId 
                ] 
            ); 
 
            if (result.affectedRows === 0) { 
 
                return res.status(404).json({ 
                    message: "Request not found" 
                }); 
 
            } 
                let notificationMessage = "";

if (status === "Accepted") {
    notificationMessage =
        `Your emergency request #${requestId} has been ACCEPTED. Please keep your phone available.`;
} else if (status === "Resolved") {
    notificationMessage =
        `Your emergency request #${requestId} has been RESOLVED.`;
} else if (status === "Cancelled") {
    notificationMessage =
        `Your emergency request #${requestId} has been CANCELLED.`;
} else {
    notificationMessage =
        `Your emergency request #${requestId} is currently PENDING.`;
}
 
           let emailSent = false;

if (requestInfo.user_email) {

    emailSent = await sendResendEmail(
        requestInfo.user_email,

        `ResQGo Emergency Request #${requestId} - ${status}`,

        `
        <h2>ResQGo Emergency Response</h2>

        <p>Hello ${requestInfo.user_name || "User"},</p>

        <p>
            Your emergency request
            <strong>#${requestId}</strong>
            has been updated.
        </p>

        <p>
            <strong>Service:</strong>
            ${requestInfo.service_type}
        </p>

        <p>
            <strong>Resource:</strong>
            ${requestInfo.resource_name || "Emergency Resource"}
        </p>

        <p>
            <strong>Status:</strong>
            ${status}
        </p>

        <p>
            ${notificationMessage}
        </p>

        <p>
            Regards,<br>
            <strong>ResQGo Emergency Response System</strong>
        </p>
        `
    );
}

res.json({

    message:
        `Request #${requestId} status updated to ${status}`,

    status,

    notificationMessage,

    emailSent
});
 
        } catch (error) { 
 
            console.error(error); 
 
            res.status(500).json({ 
                message: "Unable to update request status" 
            }); 
 
        } 
 
    } 
); 
 
 
// ===================================================== 
// GET ALERTS 
// ===================================================== 
 
app.get( 
    "/api/alerts", 
    authenticate, 
    async (req, res) => { 
 
        try { 
 
            const [rows] = await pool.execute( 
                `SELECT * 
                 FROM alerts 
                 WHERE active = TRUE 
                 ORDER BY created_at DESC` 
            ); 
 
            res.json({ 
                alerts: rows 
            }); 
 
        } catch (error) { 
 
            console.error(error); 
 
            res.status(500).json({ 
                message: "Unable to load alerts" 
            }); 
 
        } 
 
    } 
); 
 
 
// ===================================================== 
// CREATE ALERT - ADMIN 
// ===================================================== 
 
app.post( 
    "/api/alerts", 
    authenticate, 
    adminOnly, 
    async (req, res) => { 
 
        try { 
 
            const { 
                message 
            } = req.body; 
 
            if (!message || !message.trim()) { 
 
                return res.status(400).json({ 
                    message: "Alert message is required" 
                }); 
 
            } 
 
            const [result] = await pool.execute( 
                `INSERT INTO alerts 
                (message, active) 
                VALUES (?, TRUE)`, 
                [ 
                    message.trim() 
                ] 
            ); 
 
            res.status(201).json({ 
                message: "Alert broadcast successfully", 
                id: result.insertId 
            }); 
 
        } catch (error) { 
 
            console.error(error); 
 
            res.status(500).json({ 
                message: "Unable to broadcast alert" 
            }); 
 
        } 
 
    } 
); 
 
 
// ===================================================== 
// ADMIN STATISTICS 
// ===================================================== 
 
app.get( 
    "/api/admin/stats", 
    authenticate, 
    adminOnly, 
    async (req, res) => { 
 
        try { 
 
            const [[users]] = 
                await pool.execute( 
                    "SELECT COUNT(*) AS total FROM users" 
                ); 
 
            const [[resources]] = 
                await pool.execute( 
                    "SELECT COUNT(*) AS total FROM resources" 
                ); 
 
            const [[requests]] = 
                await pool.execute( 
                    "SELECT COUNT(*) AS total FROM service_requests" 
                ); 
 
            const [[pendingRequests]] = 
                await pool.execute( 
                    `SELECT COUNT(*) AS total 
                     FROM service_requests 
                     WHERE status = 'Pending'` 
                ); 
 
            res.json({ 
                users: users.total, 
                resources: resources.total, 
                requests: requests.total, 
                pendingRequests: pendingRequests.total 
            }); 
 
        } catch (error) { 
 
            console.error(error); 
 
            res.status(500).json({ 
                message: "Unable to load statistics" 
            }); 
 
        } 
 
    } 
); 
 
 
// ===================================================== 
// HEALTH CHECK 
// ===================================================== 
 
app.get("/api/health", async (req, res) => { 
 
    try { 
 
        const connection = 
            await pool.getConnection(); 
 
        connection.release(); 
 
        res.json({ 
            status: "ResQGo backend is running", 
            database: "MySQL connected" 
        }); 
 
    } catch (error) { 
 
        console.error(error); 
 
        res.status(500).json({ 
            status: "Backend running", 
            database: "MySQL connection failed" 
        }); 
 
    } 
 
}); 
 
 
// ===================================================== 
// START SERVER 
// ===================================================== 
 
const PORT = 
    process.env.PORT || 5000; 
 
app.listen(PORT, () => { 
 
    console.log( 
        `ResQGo server running at http://localhost:${PORT}` 
    ); 
 
});