const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createApp, describeDatabaseUrl, explainDatabaseError, normalizeDatabaseError } = require("./server");

test("production setup refuses missing database and secure admin credentials", () => {
    const environment = {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL: process.env.DATABASE_URL,
        ADMIN_USERNAME: process.env.ADMIN_USERNAME,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD
    };

    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;

    try {
        assert.throws(
            () => createApp(),
            /Production requires DATABASE_URL, ADMIN_USERNAME/
        );
    } finally {
        for (const [key, value] of Object.entries(environment)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
});

test("complaints can be submitted, tracked, and updated by an admin", async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "smart-campus-"));
    const app = createApp({
        databasePath: path.join(directory, "test.sqlite"),
        adminUsername: "test-admin",
        adminPassword: "test-password"
    });
    const server = app.listen(0);

    t.after(async () => {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
        app.locals.closeDatabase();
        fs.rmSync(directory, { recursive: true, force: true });
    });

    await new Promise((resolve) => server.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthResponse.status, 200);
    const health = await healthResponse.json();
    assert.equal(health.status, "ok");
    assert.equal(health.database, "sqlite");
    assert.equal(typeof health.uptimeSeconds, "number");

    const configResponse = await fetch(`${baseUrl}/api/config`);
    assert.equal(configResponse.status, 200);
    assert.deepEqual(await configResponse.json(), {
        photoUploadsEnabled: true
    });
    const javascriptPageResponse = await fetch(`${baseUrl}/script.js`);
    assert.equal(javascriptPageResponse.status, 200);
    for (const privatePath of [
        "/server.js",
        "/package.json",
        "/README.md",
        "/data/smart-campus.sqlite"
    ]) {
        const response = await fetch(`${baseUrl}${privatePath}`);
        assert.equal(response.status, 404, `${privatePath} must not be public`);
    }

    const suggestionResponse = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            description: "The Wi-Fi internet is not working in the computer lab."
        })
    });
    assert.equal(suggestionResponse.status, 200);
    const suggestion = await suggestionResponse.json();
    assert.equal(suggestion.categoryCode, "wifi");
    assert.equal(suggestion.department, "IT Department");
    assert.equal(suggestion.priority, "Medium");
    assert.equal(suggestion.emergency, false);
    assert.match(suggestion.summary, /Wi-Fi internet is not working/);

    const multilingualExamples = [
        {
            description: "Lab ka wifi nahi chal raha",
            categoryCode: "wifi",
            priority: "Medium"
        },
        {
            description: "कक्षा का पंखा खराब है",
            categoryCode: "electrical",
            priority: "Medium"
        },
        {
            description: "Hostel mein paani nahi aa raha hai",
            categoryCode: "other",
            priority: "Medium",
            needsReview: true
        },
        {
            description: "Hostel washroom mein water नहीं आ रहा",
            categoryCode: "water",
            priority: "Medium"
        }
    ];

    for (const example of multilingualExamples) {
        const response = await fetch(`${baseUrl}/api/ai/suggest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: example.description })
        });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.categoryCode, example.categoryCode);
        assert.equal(result.priority, example.priority);
        assert.equal(result.needsReview, Boolean(example.needsReview));
    }

    const hindiEmergencyResponse = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            description: "लैब में आग लग गई है और धुआं निकल रहा है"
        })
    });
    const hindiEmergency = await hindiEmergencyResponse.json();
    assert.equal(hindiEmergency.priority, "High");
    assert.equal(hindiEmergency.emergency, true);

    const uncertainResponse = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "playground is very slip" })
    });
    const uncertainSuggestion = await uncertainResponse.json();
    assert.equal(uncertainSuggestion.needsReview, true);
    assert.equal(uncertainSuggestion.categoryCode, "other");

    const longDescription =
        "The first floor corridor light is flickering. " +
        "The computer lab Wi-Fi internet connection has stopped working since morning. " +
        "The issue prevents students from attending online classes.";
    const summaryResponse = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: longDescription })
    });
    const summarySuggestion = await summaryResponse.json();
    assert.match(summarySuggestion.summary, /computer lab Wi-Fi internet/);
    assert.ok(summarySuggestion.summary.length <= 220);

    const emergencySuggestionResponse = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            description: "There is smoke and a burning smell near an exposed wire."
        })
    });
    assert.equal(emergencySuggestionResponse.status, 200);
    const emergencySuggestion = await emergencySuggestionResponse.json();
    assert.equal(emergencySuggestion.priority, "High");
    assert.equal(emergencySuggestion.emergency, true);

    const invalidSuggestionResponse = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: " " })
    });
    assert.equal(invalidSuggestionResponse.status, 400);

    let rateLimitedResponse;
    for (let index = 0; index < 21; index += 1) {
        rateLimitedResponse = await fetch(`${baseUrl}/api/ai/suggest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "wifi is not working" })
        });
    }
    assert.equal(rateLimitedResponse.status, 429);

    const complaintPayload = {
        studentName: "Test Student",
        rollNumber: "TEST-001",
        category: "Wi-Fi / Internet Issue",
        categoryCode: "wifi",
        building: "Engineering",
        floor: "1st Floor",
        roomNumber: "Lab 101",
        description: "Wi-Fi is not working.",
        priority: "Medium",
        department: "IT Department"
    };

    const createdResponse = await fetch(`${baseUrl}/api/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(complaintPayload)
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.match(created.complaintId, /^SC-\d{4}-0001$/);
    assert.equal(created.department, "IT Department");
    assert.equal(created.category, "Wi-Fi / Internet Issue");
    assert.equal(created.priority, "Medium");
    assert.equal(created.aiAssessment.categoryCode, "wifi");
    assert.equal(created.aiAssessment.emergency, false);
    assert.equal(created.aiAssessment.similarComplaintsCount, 0);
    assert.match(created.aiAssessment.summary, /Wi-Fi is not working/);

    const mismatchedCategoryResponse = await fetch(`${baseUrl}/api/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...complaintPayload,
            category: "Sanitation / Cleanliness"
        })
    });
    assert.equal(mismatchedCategoryResponse.status, 201);
    const mismatchedCategory = await mismatchedCategoryResponse.json();
    assert.equal(mismatchedCategory.category, "Wi-Fi / Internet Issue");
    assert.equal(mismatchedCategory.categoryCode, "wifi");
    assert.equal(mismatchedCategory.department, "IT Department");

    const missingOtherCategoryResponse = await fetch(`${baseUrl}/api/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...complaintPayload,
            category: "Other",
            categoryCode: "other",
            otherCategory: ""
        })
    });
    assert.equal(missingOtherCategoryResponse.status, 400);

    const secondCreatedResponse = await fetch(`${baseUrl}/api/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(complaintPayload)
    });
    assert.equal(secondCreatedResponse.status, 201);
    const secondCreated = await secondCreatedResponse.json();
    assert.equal(
        secondCreated.complaintId,
        `SC-${new Date().getFullYear()}-0003`
    );
    assert.equal(secondCreated.aiAssessment.similarComplaintsCount, 2);

    const trackedResponse = await fetch(
        `${baseUrl}/api/complaints/${created.complaintId.toLowerCase()}/track`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rollNumber: "TEST-001" })
        }
    );
    assert.equal(trackedResponse.status, 200);
    const trackedComplaint = await trackedResponse.json();
    assert.equal(trackedComplaint.complaintId, created.complaintId);
    assert.equal(trackedComplaint.status, "Submitted");
    assert.equal("studentName" in trackedComplaint, false);
    assert.equal("rollNumber" in trackedComplaint, false);
    assert.equal("description" in trackedComplaint, false);
    assert.equal("photoData" in trackedComplaint, false);

    const wrongRollNumberResponse = await fetch(
        `${baseUrl}/api/complaints/${created.complaintId}/track`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rollNumber: "WRONG-ROLL" })
        }
    );
    assert.equal(wrongRollNumberResponse.status, 404);

    const unauthorizedResponse = await fetch(`${baseUrl}/api/admin/complaints`);
    assert.equal(unauthorizedResponse.status, 401);

    const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: "test-admin",
            password: "test-password"
        })
    });
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get("set-cookie").split(";")[0];

    const updateResponse = await fetch(
        `${baseUrl}/api/admin/complaints/${created.complaintId}`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: cookie
            },
            body: JSON.stringify({
                status: "Resolved",
                adminRemark: "The issue has been fixed."
            })
        }
    );
    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.status, "Resolved");
    assert.equal(updated.adminRemark, "The issue has been fixed.");

    const wrongRollFeedbackResponse = await fetch(
        `${baseUrl}/api/complaints/${created.complaintId}/feedback`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rating: 1,
                comment: "Wrong user",
                rollNumber: "WRONG-ROLL"
            })
        }
    );
    assert.equal(wrongRollFeedbackResponse.status, 404);

    const categoryUpdateResponse = await fetch(
        `${baseUrl}/api/admin/complaints/${created.complaintId}`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: cookie
            },
            body: JSON.stringify({ categoryCode: "sanitation" })
        }
    );
    assert.equal(categoryUpdateResponse.status, 200);
    const categoryUpdated = await categoryUpdateResponse.json();
    assert.equal(categoryUpdated.categoryCode, "sanitation");
    assert.equal(categoryUpdated.category, "Sanitation / Cleanliness");
    assert.equal(categoryUpdated.department, "Housekeeping Department");
    assert.equal(categoryUpdated.aiAssessment.reviewedByAdmin, true);

    const feedbackResponse = await fetch(
        `${baseUrl}/api/complaints/${created.complaintId}/feedback`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rating: 5,
                comment: "Thank you.",
                rollNumber: "TEST-001"
            })
        }
    );
    assert.equal(feedbackResponse.status, 200);
    const feedback = await feedbackResponse.json();
    assert.equal(feedback.feedbackRating, 5);
    assert.equal("studentName" in feedback, false);
});

test("public stats endpoint returns aggregates and every status change is tracked", async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "smart-campus-stats-"));
    const app = createApp({
        databasePath: path.join(directory, "test.sqlite"),
        adminUsername: "test-admin",
        adminPassword: "test-password"
    });
    const server = app.listen(0);

    t.after(async () => {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
        app.locals.closeDatabase();
        fs.rmSync(directory, { recursive: true, force: true });
    });

    await new Promise((resolve) => server.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    for (const asset of ["/theme.js", "/ui.css", "/style.css", "/script.js"]) {
        const response = await fetch(`${baseUrl}${asset}`);
        assert.equal(response.status, 200, `${asset} must be public`);
    }

    const complaintPayload = {
        studentName: "Stats Student",
        rollNumber: "STATS-001",
        category: "Wi-Fi / Internet Issue",
        categoryCode: "wifi",
        building: "Engineering",
        floor: "1st Floor",
        roomNumber: "Lab 101",
        description: "Wi-Fi is not working.",
        priority: "Medium",
        department: "IT Department"
    };

    const createdResponse = await fetch(`${baseUrl}/api/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(complaintPayload)
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();

    assert.equal(created.status, "Submitted");
    assert.equal(created.resolvedAt, null);
    assert.equal(created.statusHistory.length, 1);
    assert.equal(created.statusHistory[0].status, "Submitted");
    assert.equal(typeof created.statusHistory[0].at, "number");

    const statsAfterCreateResponse = await fetch(`${baseUrl}/api/stats`);
    assert.equal(statsAfterCreateResponse.status, 200);
    const statsAfterCreate = await statsAfterCreateResponse.json();
    assert.equal(statsAfterCreate.total, 1);
    assert.equal(statsAfterCreate.byStatus.Submitted, 1);
    assert.equal(statsAfterCreate.resolutionRate, 0);
    assert.equal(statsAfterCreate.averageResolutionHours, null);
    assert.equal(statsAfterCreate.topCategories[0].name, "Wi-Fi / Internet Issue");
    assert.equal(statsAfterCreate.topCategories[0].count, 1);
    assert.equal(statsAfterCreate.topDepartments[0].name, "IT Department");
    assert.equal("studentName" in statsAfterCreate, false);
    assert.equal("rollNumber" in statsAfterCreate, false);

    const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: "test-admin",
            password: "test-password"
        })
    });
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get("set-cookie").split(";")[0];

    const resolveResponse = await fetch(
        `${baseUrl}/api/admin/complaints/${created.complaintId}`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: cookie
            },
            body: JSON.stringify({
                status: "Resolved",
                adminRemark: "Router restarted."
            })
        }
    );
    assert.equal(resolveResponse.status, 200);
    const resolved = await resolveResponse.json();
    assert.equal(resolved.status, "Resolved");
    assert.equal(typeof resolved.resolvedAt, "number");
    assert.equal(resolved.statusHistory.length, 2);
    assert.equal(resolved.statusHistory[1].status, "Resolved");
    assert.equal(resolved.statusHistory[1].note, "Router restarted.");

    const trackedResponse = await fetch(
        `${baseUrl}/api/complaints/${created.complaintId}/track`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rollNumber: "STATS-001" })
        }
    );
    assert.equal(trackedResponse.status, 200);
    const tracked = await trackedResponse.json();
    assert.equal(tracked.status, "Resolved");
    assert.equal(tracked.statusHistory.length, 2);
    assert.equal(typeof tracked.resolvedAt, "number");
    assert.equal(typeof tracked.createdAt, "number");
    assert.equal("studentName" in tracked, false);
    assert.equal("rollNumber" in tracked, false);

    const statsResponse = await fetch(`${baseUrl}/api/stats`);
    assert.equal(statsResponse.status, 200);
    const stats = await statsResponse.json();
    assert.equal(stats.total, 1);
    assert.equal(stats.byStatus.Resolved, 1);
    assert.equal(stats.resolutionRate, 100);
    assert.equal(typeof stats.averageResolutionHours, "number");

    const reopenResponse = await fetch(
        `${baseUrl}/api/admin/complaints/${created.complaintId}`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: cookie
            },
            body: JSON.stringify({ status: "In Progress" })
        }
    );
    assert.equal(reopenResponse.status, 200);
    const reopened = await reopenResponse.json();
    assert.equal(reopened.resolvedAt, null);
    assert.equal(reopened.statusHistory.length, 3);
    assert.equal(reopened.statusHistory[2].status, "In Progress");

    const reopenedStats = await (await fetch(`${baseUrl}/api/stats`)).json();
    assert.equal(reopenedStats.resolutionRate, 0);
    assert.equal(reopenedStats.averageResolutionHours, null);
});

test("database connection errors are explained in plain language", () => {
    const supabaseUrl =
        "postgres://postgres.abcdefgh:wrong-password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";

    const info = describeDatabaseUrl(supabaseUrl);
    assert.equal(info.host, "aws-0-ap-south-1.pooler.supabase.com");
    assert.equal(info.port, "5432");
    assert.equal(info.database, "postgres");
    assert.equal(info.username, "postgres.abcdefgh");

    const authError = new Error(
        'password authentication failed for user "postgres"'
    );
    authError.code = "28P01";

    const authMessage = explainDatabaseError(authError, supabaseUrl);
    assert.match(authMessage, /could not connect to PostgreSQL/);
    assert.match(authMessage, /password or username/);
    assert.match(authMessage, /YOUR-PASSWORD/);
    assert.match(authMessage, /code 28P01/);
    assert.match(authMessage, /aws-0-ap-south-1\.pooler\.supabase\.com:5432/);

    const missingDatabase = new Error("database does not exist");
    missingDatabase.code = "3D000";
    assert.match(
        explainDatabaseError(missingDatabase, supabaseUrl),
        /does not exist/
    );

    const unknownHost = new Error("getaddrinfo ENOTFOUND");
    unknownHost.code = "ENOTFOUND";
    assert.match(
        explainDatabaseError(unknownHost, supabaseUrl),
        /host could not be resolved/
    );

    const localUrl = "postgres://postgres:secret@localhost:5432/postgres";
    const localMessage = explainDatabaseError(authError, localUrl);
    assert.match(localMessage, /points to localhost/);

    const brokenUrl = "definitely-not-a-url";
    const brokenInfo = describeDatabaseUrl(brokenUrl);
    assert.match(brokenInfo.host, /not a valid URL/);
    assert.match(
        explainDatabaseError(authError, brokenUrl),
        /could not connect to PostgreSQL/
    );

    // Node's pg pool raises AggregateError when several addresses fail.
    const inner = new Error("connect ECONNREFUSED 127.0.0.1:5432");
    inner.code = "ECONNREFUSED";
    const aggregate = new AggregateError(
        [inner],
        "connect ECONNREFUSED 127.0.0.1:5432"
    );
    const normalized = normalizeDatabaseError(aggregate);
    assert.equal(normalized.code, "ECONNREFUSED");
    assert.match(normalized.message, /ECONNREFUSED/);
    assert.match(
        explainDatabaseError(aggregate, supabaseUrl),
        /nothing is accepting connections/
    );
});
