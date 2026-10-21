// ==========================================
// SMART CAMPUS - ADMIN DASHBOARD
// ==========================================

let complaintCache = [];
const CATEGORY_OPTIONS = [
    ["wifi", "Wi-Fi / Internet Issue"],
    ["electrical", "Electrical Problem"],
    ["sanitation", "Sanitation / Cleanliness"],
    ["infrastructure", "Infrastructure Damage"],
    ["classroom", "Classroom Problem"],
    ["hostel", "Hostel Problem"],
    ["library", "Library Problem"],
    ["security", "Security Issue"],
    ["water", "Water Supply Issue"],
    ["furniture", "Furniture Problem"],
    ["transport", "Transport Issue"],
    ["other", "Other / Needs Review"]
];

async function requestApi(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "The server could not complete the request.");
    }

    return data;
}


// ==========================================
// PAGE LOAD
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setupLogin();
        setupDashboard();
        checkLogin();

    }
);


// ==========================================
// LOGIN
// ==========================================

function setupLogin() {

    const form =
        document.getElementById(
            "loginForm"
        );


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const username =
                document.getElementById(
                    "username"
                ).value.trim();


            const password =
                document.getElementById(
                    "password"
                ).value.trim();


            const error =
                document.getElementById(
                    "loginError"
                );


            try {
                await requestApi("/api/admin/login", {
                    method: "POST",
                    body: JSON.stringify({ username, password })
                });
                if (error) {
                    error.textContent = "";
                }
                showDashboard();
            } catch (loginError) {
                if (error) {
                    error.textContent = loginError.message;
                } else {
                    console.error(loginError);
                }
            }

        }
    );

}


// ==========================================
// CHECK LOGIN
// ==========================================

async function checkLogin() {
    try {
        await requestApi("/api/admin/session");
        showDashboard();
    } catch (error) {
        if (error.message !== "Admin login required.") {
            console.error(error);
            const loginError = document.getElementById("loginError");
            if (loginError) {
                loginError.textContent =
                    "Could not connect to the server. Start the Smart Campus server and try again.";
            }
        }
        showLogin();
    }
}


// ==========================================
// SHOW LOGIN
// ==========================================

function showLogin() {

    const loginPage =
        document.getElementById(
            "loginPage"
        );


    const dashboard =
        document.getElementById(
            "dashboardPage"
        );


    if (loginPage) {
        loginPage.style.display = "flex";
    }


    if (dashboard) {
        dashboard.style.display = "none";
    }

}


// ==========================================
// SHOW DASHBOARD
// ==========================================

function showDashboard() {

    const loginPage =
        document.getElementById(
            "loginPage"
        );


    const dashboard =
        document.getElementById(
            "dashboardPage"
        );


    if (loginPage) {
        loginPage.style.display = "none";
    }


    if (dashboard) {
        dashboard.style.display = "block";
    }


    loadComplaints();

}


// ==========================================
// DASHBOARD SETUP
// ==========================================

function setupDashboard() {

    const logout =
        document.getElementById(
            "logoutButton"
        );


    if (logout) {

        logout.addEventListener(
            "click",
            async function () {
                try {
                    await requestApi("/api/admin/logout", {
                        method: "POST"
                    });
                    complaintCache = [];
                    showLogin();
                } catch (error) {
                    console.error(error);
                    alert(`Could not log out: ${error.message}`);
                }
            }
        );

    }


    const search =
        document.getElementById(
            "searchInput"
        );


    if (search) {

        search.addEventListener(
            "input",
            loadComplaints
        );

    }


    [
        "categoryFilter",
        "priorityFilter",
        "statusFilter",
        "sortFilter"
    ].forEach(
        function (id) {

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.addEventListener(
                    "change",
                    loadComplaints
                );

            }

        }
    );


    const clear =
        document.getElementById(
            "clearFiltersButton"
        );


    if (clear) {

        clear.addEventListener(
            "click",
            clearFilters
        );

    }


    const refresh =
        document.getElementById(
            "refreshButton"
        );


    if (refresh) {

        refresh.addEventListener(
            "click",
            loadComplaints
        );

    }

}


// ==========================================
// LOAD
// ==========================================

async function loadComplaints() {
    let all;
    try {
        all = await requestApi("/api/admin/complaints");
        complaintCache = all;
        showBackendError("");
    } catch (error) {
        console.error(error);
        showBackendError(
            `${error.message} Please check that the server is running and sign in again if needed.`
        );
        return;
    }


    updateSummary(
        all
    );


    updateAnalytics(
        all
    );


    let complaints =
        applyFilters(
            all
        );


    complaints =
        applySorting(
            complaints
        );


    displayComplaints(
        complaints
    );

}

function showBackendError(message) {
    const element = document.getElementById("backendError");
    if (element) {
        element.textContent = message;
        element.hidden = !message;
    }
}

function getComplaints() {
    return complaintCache;
}


// ==========================================
// SUMMARY
// ==========================================

function updateSummary(
    complaints
) {

    const total =
        complaints.length;


    const submitted =
        complaints.filter(
            function (item) {

                return (
                    item.status ===
                    "Submitted"
                );

            }
        ).length;


    const progress =
        complaints.filter(
            function (item) {

                return (
                    item.status ===
                    "In Progress"
                );

            }
        ).length;


    const resolved =
        complaints.filter(
            function (item) {

                return (
                    item.status ===
                    "Resolved"
                );

            }
        ).length;


    setText(
        "totalComplaints",
        total
    );


    setText(
        "submittedComplaints",
        submitted
    );


    setText(
        "progressComplaints",
        progress
    );


    setText(
        "resolvedComplaints",
        resolved
    );

    updateAiEmergencyAlerts(complaints);

}

function updateAiEmergencyAlerts(complaints) {
    const container = document.getElementById("aiEmergencyAlerts");
    if (!container) {
        return;
    }

    const alerts = complaints.filter(function (complaint) {
        return (
            complaint.status !== "Resolved" &&
            complaint.aiAssessment &&
            complaint.aiAssessment.emergency
        );
    });

    updateAiRecurringIssues(complaints);

    if (alerts.length === 0) {
        container.hidden = true;
        container.textContent = "";
        return;
    }

    const alertList = alerts.slice(0, 5).map(function (complaint) {
        return (
            `<li><strong>${safe(complaint.complaintId)}</strong> — ` +
            `${safe(complaint.category)} at ${safe(buildLocationText(complaint))}</li>`
        );
    }).join("");
    const additionalCount = alerts.length - 5;

    container.innerHTML =
        `<h3>AI safety review: ${alerts.length} open complaint(s)</h3>` +
        "<p>Check these complaints promptly. AI can be wrong; this alert is not an emergency service.</p>" +
        `<ul>${alertList}</ul>` +
        (
            additionalCount > 0
                ? `<p>And ${additionalCount} more open complaint(s).</p>`
                : ""
        );
    container.hidden = false;
}

function updateAiRecurringIssues(complaints) {
    const container = document.getElementById("aiRecurringIssues");
    if (!container) {
        return;
    }

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const groups = new Map();

    complaints.forEach(function (complaint) {
        const createdAt = Number(complaint.createdAt) || 0;
        if (createdAt < cutoff) {
            return;
        }

        const building = String(complaint.building || "").trim();
        const categoryCode = String(complaint.categoryCode || "other");
        const key = `${building.toLowerCase()}|${categoryCode}`;
        const group = groups.get(key) || {
            building,
            category: complaint.category || "Other",
            total: 0,
            open: 0
        };
        group.total += 1;
        if (complaint.status !== "Resolved") {
            group.open += 1;
        }
        groups.set(key, group);
    });

    const recurring = [...groups.values()]
        .filter(function (group) {
            return group.total >= 2;
        })
        .sort(function (first, second) {
            return second.total - first.total;
        })
        .slice(0, 5);

    if (recurring.length === 0) {
        container.hidden = true;
        container.textContent = "";
        return;
    }

    const items = recurring.map(function (group) {
        return (
            `<li><strong>${safe(group.total)} reports</strong> — ` +
            `${safe(group.category)} in ${safe(group.building)} ` +
            `(${safe(group.open)} still open)</li>`
        );
    }).join("");

    container.innerHTML =
        "<h3>Possible recurring campus issues</h3>" +
        "<p>Based on complaint category and location from the last 30 days. These are patterns to review, not confirmed root causes.</p>" +
        `<ul>${items}</ul>`;
    container.hidden = false;
}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {
        element.textContent = value;
    }

}


// ==========================================
// ANALYTICS
// ==========================================

function updateAnalytics(
    complaints
) {

    let section =
        document.getElementById(
            "smartCampusAnalytics"
        );


    if (!section) {

        section =
            document.createElement(
                "section"
            );


        section.id =
            "smartCampusAnalytics";


        const main =
            document.querySelector(
                ".dashboard-container"
            );


        const summary =
            main
                ? main.querySelector(
                    ".summary-grid"
                )
                : null;


        if (main) {

            if (summary) {

                summary.insertAdjacentElement(
                    "afterend",
                    section
                );

            }
            else {

                main.prepend(
                    section
                );

            }

        }

    }


    const submitted =
        complaints.filter(
            function (item) {
                return item.status === "Submitted";
            }
        ).length;


    const progress =
        complaints.filter(
            function (item) {
                return item.status === "In Progress";
            }
        ).length;


    const resolved =
        complaints.filter(
            function (item) {
                return item.status === "Resolved";
            }
        ).length;


    const high =
        complaints.filter(
            function (item) {
                return item.priority === "High";
            }
        ).length;


    const medium =
        complaints.filter(
            function (item) {
                return item.priority === "Medium";
            }
        ).length;


    const low =
        complaints.filter(
            function (item) {
                return item.priority === "Low";
            }
        ).length;


    const categoryCount = {};


    complaints.forEach(
        function (complaint) {

            const category =
                complaint.category ||
                "Other";


            categoryCount[category] =
                (
                    categoryCount[category] ||
                    0
                ) + 1;

        }
    );


    const categories =
        Object.keys(
            categoryCount
        );


    categories.sort(
        function (a, b) {

            return (
                categoryCount[b] -
                categoryCount[a]
            );

        }
    );


    let categoryHTML = "";


    if (
        categories.length === 0
    ) {

        categoryHTML =
            `
                <div class="sc-analytics-empty">
                    No complaint data available.
                </div>
            `;

    }
    else {

        categories.forEach(
            function (category) {

                const count =
                    categoryCount[
                        category
                    ];


                const percentage =
                    complaints.length
                        ? Math.round(
                            (
                                count /
                                complaints.length
                            ) * 100
                        )
                        : 0;


                categoryHTML += `

                    <div class="sc-analytics-row">

                        <div class="sc-analytics-row-top">

                            <span>
                                ${safe(
                                    category
                                )}
                            </span>

                            <strong>
                                ${count}
                            </strong>

                        </div>


                        <div class="sc-analytics-bar">

                            <div
                                class="sc-analytics-bar-fill"
                                style="width:${percentage}%"
                            ></div>

                        </div>

                    </div>

                `;

            }
        );

    }


    section.innerHTML = `

        <div class="sc-analytics-header">

            <span class="dashboard-label">
                COMPLAINT ANALYTICS
            </span>

            <h2>
                Campus Overview
            </h2>

            <p>
                Quick summary of complaint status,
                priority and categories.
            </p>

        </div>


        <div class="sc-analytics-grid">


            <div class="sc-analytics-card">

                <h3>
                    Complaint Status
                </h3>


                <div class="sc-analytics-stat">

                    <span>
                        Submitted
                    </span>

                    <strong>
                        ${submitted}
                    </strong>

                </div>


                <div class="sc-analytics-stat">

                    <span>
                        In Progress
                    </span>

                    <strong>
                        ${progress}
                    </strong>

                </div>


                <div class="sc-analytics-stat">

                    <span>
                        Resolved
                    </span>

                    <strong>
                        ${resolved}
                    </strong>

                </div>

            </div>


            <div class="sc-analytics-card">

                <h3>
                    Priority Overview
                </h3>


                <div class="sc-analytics-stat">

                    <span>
                        High Priority
                    </span>

                    <strong class="sc-high-number">
                        ${high}
                    </strong>

                </div>


                <div class="sc-analytics-stat">

                    <span>
                        Medium Priority
                    </span>

                    <strong class="sc-medium-number">
                        ${medium}
                    </strong>

                </div>


                <div class="sc-analytics-stat">

                    <span>
                        Low Priority
                    </span>

                    <strong class="sc-low-number">
                        ${low}
                    </strong>

                </div>

            </div>


            <div class="sc-analytics-card">

                <h3>
                    Category-wise Complaints
                </h3>

                <div class="sc-category-list">
                    ${categoryHTML}
                </div>

            </div>


        </div>

    `;

}


// ==========================================
// FILTERS
// ==========================================

function applyFilters(
    complaints
) {

    const searchElement =
        document.getElementById(
            "searchInput"
        );


    const categoryElement =
        document.getElementById(
            "categoryFilter"
        );


    const priorityElement =
        document.getElementById(
            "priorityFilter"
        );


    const statusElement =
        document.getElementById(
            "statusFilter"
        );


    const search =
        searchElement
            ? searchElement.value
                .trim()
                .toLowerCase()
            : "";


    const category =
        categoryElement
            ? categoryElement.value
            : "";


    const priority =
        priorityElement
            ? priorityElement.value
            : "";


    const status =
        statusElement
            ? statusElement.value
            : "";


    return complaints.filter(
        function (complaint) {

            const id =
                String(
                    complaint.complaintId ||
                    ""
                ).toLowerCase();


            const name =
                String(
                    complaint.studentName ||
                    ""
                ).toLowerCase();


            const roll =
                String(
                    complaint.rollNumber ||
                    ""
                ).toLowerCase();


            const searchMatch =
                !search ||
                id.includes(search) ||
                name.includes(search) ||
                roll.includes(search);


            const categoryMatch =
                !category ||
                complaint.categoryCode ===
                    category;


            const priorityMatch =
                !priority ||
                complaint.priority ===
                    priority;


            const statusMatch =
                !status ||
                complaint.status ===
                    status;


            return (
                searchMatch &&
                categoryMatch &&
                priorityMatch &&
                statusMatch
            );

        }
    );

}


// ==========================================
// SORTING
// ==========================================

function applySorting(
    complaints
) {

    const element =
        document.getElementById(
            "sortFilter"
        );


    const value =
        element
            ? element.value
            : "";


    const sorted =
        [...complaints];


    if (
        value === "newest"
    ) {

        sorted.sort(
            function (a, b) {

                return (
                    getDateValue(b) -
                    getDateValue(a)
                );

            }
        );

    }


    else if (
        value === "oldest"
    ) {

        sorted.sort(
            function (a, b) {

                return (
                    getDateValue(a) -
                    getDateValue(b)
                );

            }
        );

    }


    else if (
        value === "high"
    ) {

        sorted.sort(
            function (a, b) {

                return (
                    priorityRank(
                        b.priority
                    ) -
                    priorityRank(
                        a.priority
                    )
                );

            }
        );

    }


    else if (
        value === "medium"
    ) {

        sorted.sort(
            function (a, b) {

                return (
                    mediumRank(
                        a.priority
                    ) -
                    mediumRank(
                        b.priority
                    )
                );

            }
        );

    }


    else if (
        value === "low"
    ) {

        sorted.sort(
            function (a, b) {

                return (
                    lowRank(
                        a.priority
                    ) -
                    lowRank(
                        b.priority
                    )
                );

            }
        );

    }


    return sorted;

}


function priorityRank(
    priority
) {

    if (priority === "High") {
        return 3;
    }

    if (priority === "Medium") {
        return 2;
    }

    if (priority === "Low") {
        return 1;
    }

    return 0;

}


function mediumRank(
    priority
) {

    if (priority === "Medium") {
        return 1;
    }

    if (priority === "High") {
        return 2;
    }

    if (priority === "Low") {
        return 3;
    }

    return 4;

}


function lowRank(
    priority
) {

    if (priority === "Low") {
        return 1;
    }

    if (priority === "Medium") {
        return 2;
    }

    if (priority === "High") {
        return 3;
    }

    return 4;

}


// ==========================================
// DATE
// ==========================================

function getDateValue(
    complaint
) {

    if (
        complaint.createdAt
    ) {

        const timestamp =
            Number(
                complaint.createdAt
            );


        if (
            !isNaN(timestamp)
        ) {

            return timestamp;

        }

    }


    const date =
        new Date(
            complaint.date
        );


    if (
        !isNaN(
            date.getTime()
        )
    ) {

        return date.getTime();

    }


    return 0;

}


// ==========================================
// DISPLAY
// ==========================================

function displayComplaints(
    complaints
) {

    const body =
        document.getElementById(
            "complaintTableBody"
        );


    const empty =
        document.getElementById(
            "noComplaints"
        );


    const count =
        document.getElementById(
            "resultCount"
        );


    if (!body) {
        return;
    }


    body.innerHTML = "";


    if (count) {

        count.textContent =
            complaints.length +
            (
                complaints.length === 1
                    ? " complaint"
                    : " complaints"
            );

    }


    if (
        complaints.length === 0
    ) {

        if (empty) {
            empty.style.display = "block";
        }

        return;

    }


    if (empty) {
        empty.style.display = "none";
    }


    complaints.forEach(
        function (complaint) {

            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${safe(
                        complaint.complaintId
                    )}
                </td>


                <td>

                    <strong>
                        ${safe(
                            complaint.studentName
                        )}
                    </strong>

                    <br>

                    <small>
                        ${safe(
                            complaint.rollNumber
                        )}
                    </small>

                </td>


                <td>
                    ${safe(
                        complaint.category
                    )}
                </td>


                <td>

                    <span
                        class="priority-badge ${getPriorityClass(
                            complaint.priority
                        )}"
                    >
                        ${safe(
                            complaint.priority
                        )}
                    </span>
                    ${
                        complaint.aiAssessment &&
                        complaint.aiAssessment.emergency
                            ? '<span class="ai-emergency-badge">AI safety review</span>'
                            : ""
                    }

                </td>


                <td>
                    ${safe(
                        complaint.department
                    )}
                </td>


                <td>

                    ${safe(
                        buildLocationText(
                            complaint
                        )
                    )}

                </td>


                <td>
                    ${safe(
                        complaint.date
                    )}
                </td>


                <td>

                    <select
                        class="status-select"
                    >

                        <option
                            value="Submitted"
                            ${
                                complaint.status ===
                                "Submitted"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Submitted
                        </option>


                        <option
                            value="In Progress"
                            ${
                                complaint.status ===
                                "In Progress"
                                    ? "selected"
                                    : ""
                            }
                        >
                            In Progress
                        </option>


                        <option
                            value="Resolved"
                            ${
                                complaint.status ===
                                "Resolved"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Resolved
                        </option>

                    </select>

                </td>


                <td>

                    <button
                        type="button"
                        class="view-details-button"
                    >
                        View Details
                    </button>

                </td>

            `;


            body.appendChild(
                row
            );


            const status =
                row.querySelector(
                    ".status-select"
                );


            if (status) {

                status.addEventListener(
                    "change",
                    function () {

                        updateStatus(
                            complaint.complaintId,
                            this.value
                        );

                    }
                );

            }


            const details =
                row.querySelector(
                    ".view-details-button"
                );


            if (details) {

                details.addEventListener(
                    "click",
                    function () {

                        showComplaintDetails(
                            complaint.complaintId
                        );

                    }
                );

            }

        }
    );

}


// ==========================================
// STATUS
// ==========================================

async function updateStatus(
    complaintId,
    newStatus
) {
    try {
        await requestApi(
            `/api/admin/complaints/${encodeURIComponent(complaintId)}`,
            {
                method: "PATCH",
                body: JSON.stringify({ status: newStatus })
            }
        );
        await loadComplaints();
    } catch (error) {
        console.error(error);
        alert(`Status could not be updated: ${error.message}`);
        await loadComplaints();
    }

}


// ==========================================
// DETAILS
// ==========================================

function showComplaintDetails(
    complaintId
) {

    const complaints =
        getComplaints();


    const complaint =
        complaints.find(
            function (item) {

                return (
                    item.complaintId ===
                    complaintId
                );

            }
        );


    if (!complaint) {

        alert(
            "Complaint details not found."
        );

        return;

    }


    const old =
        document.getElementById(
            "complaintDetailsModal"
        );


    if (old) {
        old.remove();
    }


    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "complaintDetailsModal";


    const photo =
        complaint.photoData
            ? `

                <div class="sc-detail-section">

                    <h3>
                        Supporting Evidence
                    </h3>

                    <div class="sc-photo-box">

                        <img
                            src="${safe(
                                complaint.photoData
                            )}"
                            alt="Complaint Evidence"
                        >

                        <p>
                            ${safe(
                                complaint.photoName ||
                                "Uploaded photo"
                            )}
                        </p>

                    </div>

                </div>

            `
            : `

                <div class="sc-detail-section">

                    <h3>
                        Supporting Evidence
                    </h3>

                    <div class="sc-no-photo">
                        No photo uploaded for this complaint.
                    </div>

                </div>

            `;


    const rating =
        Number(
            complaint.feedbackRating ||
            0
        );


    const feedback =
        rating > 0
            ? `

                <div class="sc-detail-section">

                    <h3>
                        Student Feedback
                    </h3>

                    <div class="sc-feedback-display">

                        <div class="sc-feedback-stars">

                            ${
                                "★".repeat(
                                    rating
                                )
                            }

                            ${
                                "☆".repeat(
                                    5 - rating
                                )
                            }

                        </div>


                        <p>
                            ${
                                complaint.feedbackComment
                                    ? safe(
                                        complaint.feedbackComment
                                      )
                                    : "No written comment provided."
                            }
                        </p>

                    </div>

                </div>

            `
            : `

                <div class="sc-detail-section">

                    <h3>
                        Student Feedback
                    </h3>

                    <div class="sc-no-feedback">
                        Student has not submitted feedback yet.
                    </div>

                </div>

            `;


    modal.innerHTML = `

        <div class="sc-modal-overlay">


            <div class="sc-modal-box">


                <div class="sc-modal-header">

                    <div>

                        <h2>
                            Complaint Details
                        </h2>

                        <p>
                            ${safe(
                                complaint.complaintId
                            )}
                        </p>

                    </div>


                    <button
                        type="button"
                        class="sc-modal-close"
                        id="closeComplaintModal"
                    >
                        ×
                    </button>

                </div>


                <div class="sc-modal-content">


                    <!-- STUDENT -->

                    <div class="sc-detail-section">

                        <h3>
                            Student Information
                        </h3>


                        <div class="sc-detail-grid">


                            <div class="sc-detail-item">

                                <span>
                                    Student Name
                                </span>

                                <strong>
                                    ${safe(
                                        complaint.studentName
                                    )}
                                </strong>

                            </div>


                            <div class="sc-detail-item">

                                <span>
                                    Roll Number
                                </span>

                                <strong>
                                    ${safe(
                                        complaint.rollNumber
                                    )}
                                </strong>

                            </div>

                        </div>

                    </div>


                    <!-- COMPLAINT -->

                    <div class="sc-detail-section">

                        <h3>
                            Complaint Information
                        </h3>


                        <div class="sc-detail-grid">


                            <div class="sc-detail-item">

                                <span>
                                    Complaint ID
                                </span>

                                <strong>
                                    ${safe(
                                        complaint.complaintId
                                    )}
                                </strong>

                            </div>


                            <div class="sc-detail-item">

                                <span>
                                    Category
                                </span>

                                <strong>
                                    ${safe(
                                        complaint.category
                                    )}
                                </strong>

                            </div>


                            <div class="sc-detail-item">

                                <span>
                                    Priority
                                </span>

                                <strong>
                                    ${safe(
                                        complaint.priority
                                    )}
                                </strong>

                            </div>


                            <div class="sc-detail-item">

                                <span>
                                    Department
                                </span>

                                <strong>
                                    ${safe(
                                        complaint.department
                                    )}
                                </strong>

                            </div>


                            <div class="sc-detail-item">

                                <span>
                                    Status
                                </span>

                                <strong>
                                    ${safe(
                                        complaint.status
                                    )}
                                </strong>

                            </div>


                            <div class="sc-detail-item">

                                <span>
                                    Submitted On
                                </span>

                                <strong>
                                    ${safe(
                                        complaint.date
                                    )}
                                </strong>

                            </div>

                            <div class="sc-category-correction">
                                <label for="adminCategoryCorrection">
                                    Correct category
                                </label>
                                <div class="sc-category-correction-controls">
                                    <select id="adminCategoryCorrection">
                                        ${
                                            CATEGORY_OPTIONS.map(function ([code, label]) {
                                                return `
                                                    <option
                                                        value="${code}"
                                                        ${complaint.categoryCode === code ? "selected" : ""}
                                                    >${safe(label)}</option>
                                                `;
                                            }).join("")
                                        }
                                    </select>
                                    <button
                                        type="button"
                                        id="saveAdminCategory"
                                        class="sc-save-remark-button"
                                    >
                                        Save Category
                                    </button>
                                </div>
                                <div class="sc-remark-help">
                                    Saving a corrected category also updates the responsible department.
                                </div>
                            </div>

                        </div>

                    </div>


                    <!-- LOCATION -->

                    <div class="sc-detail-section">

                        <h3>
                            Location
                        </h3>


                        <div class="sc-detail-grid">


                            <div class="sc-detail-item">

                                <span>
                                    Building / Section
                                </span>

                                <strong>
                                    ${safe(
                                        complaint.building
                                    )}
                                </strong>

                            </div>


                            <div class="sc-detail-item">

                                <span>
                                    Floor
                                </span>

                                <strong>
                                    ${safe(
                                        complaint.floor
                                    )}
                                </strong>

                            </div>


                            <div class="sc-detail-item">

                                <span>
                                    Room / Lab
                                </span>

                                <strong>
                                    ${safe(
                                        complaint.roomNumber ||
                                        "Not provided"
                                    )}
                                </strong>

                            </div>

                        </div>

                    </div>


                    <!-- AI SUMMARY -->

                    ${
                        complaint.aiAssessment &&
                        complaint.aiAssessment.summary
                            ? `
                                <div class="sc-detail-section">
                                    <h3>AI Quick Summary</h3>
                                    <div class="sc-ai-summary-box">
                                        ${safe(complaint.aiAssessment.summary)}
                                    </div>
                                    <div class="sc-remark-help">
                                        Short extractive summary for convenience. Check the original description below.
                                    </div>
                                </div>
                            `
                            : ""
                    }


                    <!-- DESCRIPTION -->

                    <div class="sc-detail-section">

                        <h3>
                            Complaint Description
                        </h3>


                        <div class="sc-description-box">

                            ${safe(
                                complaint.description ||
                                "No description provided."
                            )}

                        </div>

                    </div>


                    ${photo}


                    <!-- ADMIN REMARK -->

                    <div class="sc-detail-section">

                        <h3>
                            Admin Remark / Update
                        </h3>


                        <textarea
                            id="adminRemarkInput"
                            class="sc-admin-remark-input"
                            rows="5"
                            placeholder="Write an update for the student..."
                        >${safe(
                            complaint.adminRemark ||
                            ""
                        )}</textarea>


                        <div class="sc-remark-help">

                            This message will be visible to the student
                            when they track this complaint.

                        </div>


                        <div class="sc-remark-actions">

                            <button
                                type="button"
                                id="saveAdminRemark"
                                class="sc-save-remark-button"
                            >
                                Save Remark
                            </button>

                        </div>

                    </div>


                    ${feedback}


                    <div class="sc-modal-footer">

                        <button
                            type="button"
                            id="closeComplaintModalBottom"
                            class="sc-modal-close-button"
                        >
                            Close
                        </button>

                    </div>

                </div>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    document.getElementById(
        "closeComplaintModal"
    ).addEventListener(
        "click",
        closeComplaintModal
    );


    document.getElementById(
        "closeComplaintModalBottom"
    ).addEventListener(
        "click",
        closeComplaintModal
    );


    document.getElementById(
        "saveAdminRemark"
    ).addEventListener(
        "click",
        function () {

            saveAdminRemark(
                complaint.complaintId
            );

        }
    );

    document.getElementById(
        "saveAdminCategory"
    ).addEventListener(
        "click",
        function () {
            saveAdminCategory(complaint.complaintId);
        }
    );


    const overlay =
        modal.querySelector(
            ".sc-modal-overlay"
        );


    overlay.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                overlay
            ) {

                closeComplaintModal();

            }

        }
    );


    document.addEventListener(
        "keydown",
        handleModalEscape
    );

}


// ==========================================
// SAVE REMARK
// ==========================================

async function saveAdminCategory(complaintId) {
    const select = document.getElementById("adminCategoryCorrection");
    const button = document.getElementById("saveAdminCategory");
    if (!select || !button) {
        return;
    }

    button.disabled = true;
    try {
        await requestApi(
            `/api/admin/complaints/${encodeURIComponent(complaintId)}`,
            {
                method: "PATCH",
                body: JSON.stringify({ categoryCode: select.value })
            }
        );
        await loadComplaints();
        button.textContent = "Saved";
        showComplaintDetails(complaintId);
    } catch (error) {
        console.error(error);
        alert(`Category could not be updated: ${error.message}`);
        button.disabled = false;
    }
}

async function saveAdminRemark(
    complaintId
) {

    const input =
        document.getElementById(
            "adminRemarkInput"
        );


    if (!input) {
        return;
    }


    const remark =
        input.value.trim();


    if (
        remark.length > 1000
    ) {

        alert(
            "Admin remark must be 1000 characters or less."
        );

        return;

    }


    try {
        await requestApi(
            `/api/admin/complaints/${encodeURIComponent(complaintId)}`,
            {
                method: "PATCH",
                body: JSON.stringify({ adminRemark: remark })
            }
        );
        await loadComplaints();
    } catch (error) {
        console.error(error);
        alert(`Admin remark could not be saved: ${error.message}`);
        return;
    }


    const button =
        document.getElementById(
            "saveAdminRemark"
        );


    if (button) {

        button.textContent =
            "Saved ✓";


        setTimeout(
            function () {

                if (button) {

                    button.textContent =
                        "Save Remark";

                }

            },
            1500
        );

    }

}


// ==========================================
// CLOSE MODAL
// ==========================================

function closeComplaintModal() {

    const modal =
        document.getElementById(
            "complaintDetailsModal"
        );


    if (modal) {
        modal.remove();
    }


    document.removeEventListener(
        "keydown",
        handleModalEscape
    );

}


function handleModalEscape(
    event
) {

    if (
        event.key === "Escape"
    ) {

        closeComplaintModal();

    }

}


// ==========================================
// CLEAR FILTERS
// ==========================================

function clearFilters() {

    [
        "searchInput",
        "categoryFilter",
        "priorityFilter",
        "statusFilter",
        "sortFilter"
    ].forEach(
        function (id) {

            const element =
                document.getElementById(
                    id
                );


            if (element) {
                element.value = "";
            }

        }
    );


    loadComplaints();

}


// ==========================================
// PRIORITY CLASS
// ==========================================

function getPriorityClass(
    priority
) {

    const value =
        String(
            priority || ""
        )
        .toLowerCase();


    if (value === "high") {
        return "high";
    }

    if (value === "medium") {
        return "medium";
    }

    return "low";

}


// ==========================================
// LOCATION
// ==========================================

function buildLocationText(
    complaint
) {

    const parts = [];


    if (complaint.building) {

        parts.push(
            complaint.building
        );

    }


    if (complaint.floor) {

        parts.push(
            complaint.floor
        );

    }


    if (complaint.roomNumber) {

        parts.push(
            "Room/Lab: " +
            complaint.roomNumber
        );

    }


    if (
        parts.length === 0
    ) {

        return "Not provided";

    }


    return parts.join(
        " | "
    );

}


// ==========================================
// SAFE
// ==========================================

function safe(
    value
) {

    return String(
        value ?? ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}