const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createApp } = require("./server");

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
    assert.deepEqual(await healthResponse.json(), { status: "ok" });

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
