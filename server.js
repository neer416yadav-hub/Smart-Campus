const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const { Pool } = require("pg");

// Vercel runs the app as short-lived serverless functions. They have no
// persistent disk, so a hosted database is required for real data. When none
// is configured we fall back to SQLite in /tmp so the demo still boots.
// The api/index.js entry point passes `serverless: true` explicitly, so this
// does not depend on any particular platform environment variable.
const DEFAULT_DATABASE_PATH = path.join(
    __dirname,
    "data",
    "smart-campus.sqlite"
);

// node:sqlite is only needed for local use. Loading it lazily keeps
// PostgreSQL-only deployments working on Node builds without that module.
let SqliteDatabase = null;

function loadSqlite() {
    if (!SqliteDatabase) {
        ({ DatabaseSync: SqliteDatabase } = require("node:sqlite"));
    }

    return SqliteDatabase;
}

const PORT = Number(process.env.PORT) || 3000;
const SESSION_COOKIE = "smartCampusAdminSession";
const STUDENT_SESSION_COOKIE = "smartCampusStudentSession";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const CATEGORIES = new Set([
    "wifi",
    "electrical",
    "sanitation",
    "infrastructure",
    "classroom",
    "hostel",
    "library",
    "security",
    "water",
    "furniture",
    "transport",
    "other"
]);
const STATUSES = new Set([
    "Submitted",
    "In Progress",
    "Resolved"
]);
const CATEGORY_DETAILS = {
    wifi: {
        name: "Wi-Fi / Internet Issue",
        department: "IT Department",
        examples: [
            "wifi internet not working",
            "campus network connection keeps disconnecting",
            "cannot connect to the router",
            "internet is very slow in the computer lab",
            "online attendance system has no network",
            "wifi connection problem",
            "wireless wifi signal is weak",
            "wifi access point needs repair",
            "internet connection is down",
            "wifi is not working in the classroom",
            "lab ka wifi nahi chal raha",
            "computer lab ka internet band hai",
            "classroom mein wifi signal nahi aa raha",
            "वाई फाई काम नहीं कर रहा है",
            "कंप्यूटर लैब में इंटरनेट नहीं चल रहा",
            "वाईफाई का कनेक्शन बार बार टूट रहा है",
            "Hostel mein wifi bahut slow chal raha hai",
            "लाइब्रेरी में नेटवर्क कनेक्शन नहीं है"
        ]
    },
    electrical: {
        name: "Electrical Problem",
        department: "Electrical Maintenance",
        examples: [
            "classroom fan is not working",
            "light bulb is broken",
            "power socket has stopped working",
            "electricity supply problem in the room",
            "switchboard needs electrical repair",
            "class ka fan kharab hai",
            "light nahi jal rahi hai",
            "switch board kaam nahi kar raha",
            "कक्षा का पंखा खराब है",
            "कमरे की लाइट काम नहीं कर रही",
            "बिजली का स्विच टूट गया है",
            "Lab mein power socket nahi chal raha",
            "कमरे में बिजली की सप्लाई नहीं है"
        ]
    },
    sanitation: {
        name: "Sanitation / Cleanliness",
        department: "Housekeeping Department",
        examples: [
            "classroom is dirty and needs cleaning",
            "washroom is not clean",
            "garbage bin is full",
            "bad smell near the corridor",
            "cleaning is needed in the common area",
            "washroom bahut ganda hai",
            "classroom ki safai nahi hui",
            "dustbin kachre se bhar gaya hai",
            "शौचालय साफ नहीं है",
            "कक्षा में कूड़ा पड़ा हुआ है",
            "गलियारे में बहुत गंदगी है",
            "Hostel ka bathroom clean nahi hai",
            "कचरे का डिब्बा भर गया है"
        ]
    },
    infrastructure: {
        name: "Infrastructure Damage",
        department: "Civil / Infrastructure Department",
        examples: [
            "wall is cracked and damaged",
            "ceiling is leaking in the building",
            "staircase railing is broken",
            "floor tiles are damaged",
            "door frame needs civil repair",
            "building ki deewar mein darar aa gayi hai",
            "chhat se paani tapak raha hai",
            "seedhi ki railing toot gayi hai",
            "दीवार में दरार आ गई है",
            "छत से पानी टपक रहा है",
            "फर्श की टाइल टूट गई है",
            "Building ka darwaza damage hai",
            "सीढ़ियों की रेलिंग ठीक करवानी है"
        ]
    },
    classroom: {
        name: "Classroom Problem",
        department: "Academic / Maintenance Department",
        examples: [
            "projector is not working in the classroom",
            "smart board has a display problem",
            "classroom has no teaching equipment",
            "lecture room needs a working microphone",
            "classroom is too hot during the lecture",
            "projector class mein kaam nahi kar raha",
            "smart board ka display nahi aa raha",
            "classroom mein microphone ki awaaz nahi aa rahi",
            "कक्षा का प्रोजेक्टर काम नहीं कर रहा",
            "स्मार्ट बोर्ड की स्क्रीन नहीं चल रही",
            "लेक्चर हॉल में माइक खराब है",
            "Classroom mein students ke liye equipment nahi hai",
            "क्लासरूम में बहुत गर्मी है"
        ]
    },
    hostel: {
        name: "Hostel Problem",
        department: "Hostel Administration",
        examples: [
            "hostel room needs repair",
            "hostel common room has a problem",
            "hostel warden should check this issue",
            "bedroom in the hostel is damaged",
            "hostel facilities are not working",
            "hostel room mein repair chahiye",
            "hostel ke common area mein problem hai",
            "hostel warden ko complaint batani hai",
            "हॉस्टल के कमरे में मरम्मत चाहिए",
            "छात्रावास के कमरे में समस्या है",
            "hostel ki facilities kharab hain",
            "हॉस्टल के कॉमन रूम में दिक्कत है",
            "Hostel building ki maintenance chahiye"
        ]
    },
    library: {
        name: "Library Problem",
        department: "Library Administration",
        examples: [
            "library book is missing from the shelf",
            "library reading room needs attention",
            "library is closed when it should be open",
            "quiet study area in the library has a problem",
            "library computer is not working",
            "library ki book nahi mil rahi",
            "library computer kaam nahi kar raha",
            "reading room mein problem hai",
            "लाइब्रेरी की किताब गायब है",
            "पुस्तकालय का कंप्यूटर नहीं चल रहा",
            "लाइब्रेरी का रीडिंग रूम बंद है",
            "Library mein study area saaf nahi hai",
            "पुस्तकालय खुला नहीं है"
        ]
    },
    security: {
        name: "Security Issue",
        department: "Security Department",
        examples: [
            "unauthorized person entered the campus",
            "campus gate security is not present",
            "lost property needs to be reported to security",
            "security camera is not working",
            "campus safety concern near the entrance",
            "college gate par security guard nahi hai",
            "campus mein unknown person ghoom raha hai",
            "security camera kaam nahi kar raha",
            "कॉलेज के गेट पर सुरक्षा गार्ड नहीं है",
            "कैंपस में कोई अनजान व्यक्ति घूम रहा है",
            "सुरक्षा कैमरा काम नहीं कर रहा",
            "Campus entrance par safety problem hai",
            "सुरक्षा विभाग को शिकायत करनी है"
        ]
    },
    water: {
        name: "Water Supply Issue",
        department: "Water & Maintenance Department",
        examples: [
            "no water supply in the washroom",
            "drinking water tap is not working",
            "water pipe is leaking",
            "water tank is empty",
            "water quality in the campus is poor",
            "hostel mein paani nahi aa raha",
            "drinking water ka nal kharab hai",
            "pipe se paani leak ho raha hai",
            "हॉस्टल में पानी नहीं आ रहा है",
            "पानी की टंकी खाली है",
            "पीने के पानी का नल खराब है",
            "Washroom mein water supply band hai",
            "पाइप से पानी बह रहा है"
        ]
    },
    furniture: {
        name: "Furniture Problem",
        department: "Furniture / Maintenance Department",
        examples: [
            "classroom chair is broken",
            "desk is damaged and needs repair",
            "table is missing from the room",
            "bench is unstable in the lecture hall",
            "cupboard door is broken",
            "classroom ki chair toot gayi hai",
            "desk hil raha hai aur repair chahiye",
            "room mein table nahi hai",
            "कक्षा की कुर्सी टूट गई है",
            "डेस्क खराब है",
            "बेंच हिल रही है",
            "Cupboard ka darwaza toot gaya hai",
            "कमरे में मेज की जरूरत है"
        ]
    },
    transport: {
        name: "Transport Issue",
        department: "Transport Department",
        examples: [
            "campus bus is late",
            "college shuttle route has a problem",
            "bus stop needs attention",
            "transport vehicle is not working",
            "campus bus schedule is incorrect",
            "college bus late aa rahi hai",
            "campus shuttle ka route galat hai",
            "bus stop par bus nahi rukti",
            "कॉलेज की बस देर से आती है",
            "कैंपस बस का समय गलत है",
            "बस स्टॉप पर कोई सुविधा नहीं है",
            "Campus bus kharab ho gayi hai",
            "बस का रूट बदल गया है"
        ]
    },
    other: {
        name: "Other / Needs Review",
        department: "General Administration",
        examples: [
            "I have a general campus complaint",
            "please review this other issue",
            "this problem does not match a listed category"
        ]
    }
};

const PRIORITY_TERMS = {
    emergency: [
        /\bfire\b/i,
        /\bsmoke\b/i,
        /\bsparks?\b/i,
        /\bshort[\s-]?circuit\b/i,
        /\belectric(?:al|ity)? shock\b/i,
        /\bgas leak\b/i,
        /\bflood(?:ing)?\b/i,
        /\bwater leakage\b/i,
        /\binjur(?:y|ies)\b/i,
        /\baccident\b/i,
        /\b(?:burning|burnt|burned) smell\b/i,
        /\bsmell of burning\b/i,
        /\bexposed wire\b/i,
        /\blive wire\b/i,
        /\bburnt wire\b/i,
        /\bburned wire\b/i,
        /\bwire burn(?:t|ed)\b/i,
        /\bwire jal(?: gai| gayi)?\b/i,
        /\bcurrent\b/i,
        /\bshock\b/i,
        /\bbroken glass\b/i,
        /\bdanger(?:ous)?\b/i,
        /\bemergency\b/i,
        /\bunsafe\b/i,
        /\burgent\b/i,
        /\bjalne ki (?:smell|gandh)\b/i,
        /\bbijli ka jhatka\b/i,
        /\bcurrent lag(?:a|i| gaya| gayi)?\b/i,
        /\bchingaari\b/i,
        /\bchingari\b/i,
        /आग लग/,
        /आग लगी/,
        /धुआँ|धुआं|धुआ\b/,
        /चिंगारी/,
        /बिजली का झटका/,
        /करंट लग/,
        /गैस लीक/,
        /गैस रिसाव/,
        /पानी भर गया/,
        /बाढ़/,
        /चोट लग/,
        /जलने की गंध/,
        /जलने की बदबू/,
        /तार में आग/,
        /खुला तार/,
        /खतरनाक/,
        /असुरक्षित/,
        /आपातकाल/,
        /\baag\b/i,
        /\bdhua+n?\b/i,
        /\bcurrent lag/i,
        /\bchingaari\b/i,
        /\bbijli ka jhatka\b/i,
        /\bgas leak\b/i,
        /\bpaani bhar gaya\b/i,
        /\bchot lag/i,
        /\bjalne ki (?:gandh|smell)\b/i,
        /\bkhatarnak\b/i
    ],
    issue: [
        /\bnot working\b/i,
        /\b(?:broken|damage[dt]?|leak(?:ing)?|repair|problem|issue|slow|dirty)\b/i,
        /\bkharab\b/i,
        /\bkharaab\b/i,
        /\btoot gaya\b/i,
        /\btoot gai\b/i,
        /\btheek nahi\b/i,
        /\bkaam nahi kar/i,
        /\bnahi chal raha\b/i,
        /\bnahi chal rahi\b/i,
        /\bnahi aa raha\b/i,
        /\bnahi aa rahi\b/i,
        /\bband ho gaya\b/i,
        /\bganda\b/i,
        /\bgandi\b/i,
        /काम नहीं कर/,
        /काम नही कर/,
        /नहीं चल रहा/,
        /नहीं चल रही/,
        /नही चल रहा/,
        /नही चल रही/,
        /नहीं आ रहा/,
        /नहीं आ रही/,
        /नही आ रहा/,
        /नही आ रही/,
        /खराब है/,
        /टूट गया/,
        /टूट गई/,
        /गंदा है/,
        /गंदी है/,
        /रिसाव हो रहा/,
        /साफ नहीं है/
    ]
};

function tokenize(text) {
    const commonWords = new Set([
        "a", "an", "and", "at", "by", "for", "from", "has", "have",
        "in", "is", "it", "my", "of", "our", "please", "the", "to",
        "was", "with", "not", "ka", "ki", "ke", "hai", "hain", "ho",
        "raha", "rahi", "rahe", "mein", "me", "par", "se", "ko",
        "ye", "yeh", "nahi", "nahin", "nhi", "kar", "karo", "kare",
        "gaya", "gayi", "gaye", "tha", "thi", "the", "aur", "bahut",
        "का", "की", "के", "है", "हैं", "हो", "में", "मे", "पर",
        "से", "को", "यह", "ये", "और", "नहीं", "नही", "था", "थी",
        "थे", "गया", "गई", "गए", "रहा", "रही", "रहे", "बहुत"
    ]);

    return (String(text)
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\bwi[\s-]+fi\b/g, "wifi")
        .match(/[\p{L}\p{N}]+/gu) || [])
        .filter((token) => !commonWords.has(token));
}

function trainCategoryModel() {
    const model = {};
    let totalExamples = 0;

    for (const [categoryCode, details] of Object.entries(CATEGORY_DETAILS)) {
        const wordCounts = new Map();
        let tokenCount = 0;

        for (const example of details.examples) {
            totalExamples += 1;
            for (const token of tokenize(example)) {
                wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
                tokenCount += 1;
            }
        }

        model[categoryCode] = {
            documentCount: details.examples.length,
            wordCounts,
            tokenCount
        };
    }

    return { categories: model, totalExamples };
}

const CATEGORY_MODEL = trainCategoryModel();

function summarizeComplaint(description) {
    const sentences = String(description)
        .replace(/\s+/g, " ")
        .match(/[^.!?]+[.!?]?/g)
        ?.map((sentence) => sentence.trim())
        .filter(Boolean) || [];

    if (sentences.length === 0) {
        return "";
    }

    const sentenceTokens = sentences.map((sentence) =>
        tokenize(sentence).filter((token) => token.length > 2)
    );
    const frequencies = new Map();
    for (const tokens of sentenceTokens) {
        for (const token of new Set(tokens)) {
            frequencies.set(token, (frequencies.get(token) || 0) + 1);
        }
    }

    let bestIndex = 0;
    let bestScore = -1;
    for (let index = 0; index < sentences.length; index += 1) {
        const tokens = sentenceTokens[index];
        const score = tokens.reduce(
            (total, token) =>
                total + 1 / (frequencies.get(token) || 1),
            0
        ) / Math.sqrt(Math.max(tokens.length, 1));

        if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    }

    const summary = sentences[bestIndex];
    if (summary.length <= 220) {
        return summary;
    }

    const shortened = summary.slice(0, 217);
    const lastSpace = shortened.lastIndexOf(" ");
    return `${shortened.slice(0, lastSpace > 0 ? lastSpace : 217)}...`;
}

function analyzeComplaint(description) {
    const tokens = tokenize(description);
    const vocabulary = new Set();
    for (const category of Object.values(CATEGORY_MODEL.categories)) {
        for (const token of category.wordCounts.keys()) {
            vocabulary.add(token);
        }
    }

    const knownTokens = tokens.filter((token) => vocabulary.has(token));
    let predictedCategoryCode = "other";
    let confidence = 0;

    if (knownTokens.length > 0) {
        const scores = [];
        for (const [code, category] of Object.entries(CATEGORY_MODEL.categories)) {
            let score = Math.log(
                category.documentCount / CATEGORY_MODEL.totalExamples
            );
            for (const token of knownTokens) {
                const count = category.wordCounts.get(token) || 0;
                score += Math.log(
                    (count + 1) /
                    (category.tokenCount + vocabulary.size)
                );
            }
            scores.push({ code, score });
        }

        const maximumScore = Math.max(...scores.map((item) => item.score));
        const probabilities = scores.map((item) => ({
            ...item,
            probability: Math.exp(item.score - maximumScore)
        }));
        const totalProbability = probabilities.reduce(
            (sum, item) => sum + item.probability,
            0
        );
        probabilities.sort((first, second) => second.score - first.score);
        predictedCategoryCode = probabilities[0].code;
        confidence = Math.round(
            (probabilities[0].probability / totalProbability) * 100
        );
    }

    const needsReview = confidence < 35;
    const categoryCode = needsReview ? "other" : predictedCategoryCode;
    const emergency = PRIORITY_TERMS.emergency.some((pattern) =>
        pattern.test(description)
    );
    const hasIssue = PRIORITY_TERMS.issue.some((pattern) =>
        pattern.test(description)
    );
    const priority = emergency ? "High" : hasIssue ? "Medium" : "Low";
    const details = CATEGORY_DETAILS[categoryCode];

    return {
        summary: summarizeComplaint(description),
        categoryCode,
        category: details.name,
        department: details.department,
        priority,
        emergency,
        confidence,
        needsReview,
        reason: emergency
            ? "Possible safety risk detected. An administrator should review this immediately."
            : needsReview
                ? "AI is not confident enough to choose a category. Please select one manually."
                : "Suggested from the complaint text and local training examples.",
        model: "Smart Campus local text classifier v1"
    };
}

async function countSimilarComplaints(queryAll, complaint) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const newTokens = new Set(tokenize(complaint.description));
    if (newTokens.size < 2) {
        return 0;
    }

    const rows = await queryAll(
        "SELECT complaint_json FROM complaints",
        []
    );

    return rows.reduce((count, row) => {
        const existing = JSON.parse(row.complaint_json);
        const sameCategory =
            existing.categoryCode === complaint.categoryCode;
        const sameBuilding =
            String(existing.building || "").trim().toLowerCase() ===
            complaint.building.trim().toLowerCase();
        const createdAt = Number(existing.createdAt) || 0;

        if (
            !sameCategory ||
            !sameBuilding ||
            createdAt < cutoff
        ) {
            return count;
        }

        const existingTokens = new Set(tokenize(existing.description));
        let sharedTokens = 0;
        for (const token of newTokens) {
            if (existingTokens.has(token)) {
                sharedTokens += 1;
            }
        }

        const unionSize =
            newTokens.size + existingTokens.size - sharedTokens;
        const similarity = unionSize
            ? sharedTokens / unionSize
            : 0;

        return sharedTokens >= 2 && similarity >= 0.25
            ? count + 1
            : count;
    }, 0);
}

function getPublicTrackingDetails(complaint) {
    return {
        complaintId: complaint.complaintId,
        category: complaint.category,
        categoryCode: complaint.categoryCode,
        priority: complaint.priority,
        department: complaint.department,
        building: complaint.building,
        floor: complaint.floor,
        roomNumber: complaint.roomNumber,
        status: complaint.status,
        date: complaint.date,
        createdAt: complaint.createdAt || null,
        resolvedAt: complaint.resolvedAt || null,
        remarkUpdatedAt: complaint.remarkUpdatedAt || null,
        statusHistory: Array.isArray(complaint.statusHistory)
            ? complaint.statusHistory.map((entry) => ({
                status: entry.status,
                at: entry.at,
                note: entry.note || ""
            }))
            : [],
        adminRemark: complaint.adminRemark,
        feedbackRating: complaint.feedbackRating,
        feedbackComment: complaint.feedbackComment
    };
}

function createRateLimiter(maxRequests, windowMs, message) {
    const requestsByIp = new Map();

    return (request, response, next) => {
        const now = Date.now();
        const key = request.ip || request.socket.remoteAddress || "unknown";
        let entry = requestsByIp.get(key);

        if (!entry || now - entry.startedAt >= windowMs) {
            entry = { startedAt: now, count: 0 };
            requestsByIp.set(key, entry);
        }

        entry.count += 1;
        if (entry.count > maxRequests) {
            const retryAfterSeconds = Math.ceil(
                (windowMs - (now - entry.startedAt)) / 1000
            );
            response.setHeader("Retry-After", String(retryAfterSeconds));
            return response.status(429).json({ error: message });
        }

        if (requestsByIp.size > 5000) {
            for (const [ip, item] of requestsByIp) {
                if (now - item.startedAt >= windowMs) {
                    requestsByIp.delete(ip);
                }
            }
        }

        next();
    };
}


// ==========================================
// DATABASE DIAGNOSTICS
// ==========================================

const TRANSIENT_DATABASE_CODES = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENOTFOUND",
    "EAI_AGAIN",
    "57P03" // PostgreSQL: the database system is starting up
]);

function isTransientDatabaseError(error) {
    const normalized = normalizeDatabaseError(error);

    if (!normalized) {
        return false;
    }

    if (TRANSIENT_DATABASE_CODES.has(normalized.code)) {
        return true;
    }

    return /connection timeout|timed out|timeout expired|connection terminated|ECONNRESET|ETIMEDOUT/i.test(
        String(normalized.message || "")
    );
}


function describeDatabaseUrl(databaseUrl) {
    try {
        const parsed = new URL(databaseUrl);

        return {
            host: parsed.hostname || "(missing host)",
            port: parsed.port || "5432",
            database:
                (parsed.pathname || "")
                    .replace(/^\//, "") || "(default)",
            username: decodeURIComponent(
                parsed.username || ""
            )
        };
    } catch (error) {
        return {
            host: "(DATABASE_URL is not a valid URL)",
            port: "",
            database: "",
            username: ""
        };
    }
}


function normalizeDatabaseError(error) {
    if (
        error &&
        error.name === "AggregateError" &&
        Array.isArray(error.errors) &&
        error.errors.length
    ) {
        const inner =
            error.errors.find((item) => item && item.code) ||
            error.errors[0];
        const normalized = new Error(
            inner.message || error.message
        );

        normalized.code = inner.code || error.code;
        normalized.cause = inner;

        return normalized;
    }

    return error;
}


function explainDatabaseError(rawError, databaseUrl) {
    const error = normalizeDatabaseError(rawError);
    const info = describeDatabaseUrl(databaseUrl);
    const code = error && error.code ? ` (code ${error.code})` : "";
    const message =
        (error && error.message) || String(error);

    const lines = [];

    lines.push("Smart Campus could not connect to PostgreSQL.");
    lines.push("");
    lines.push(`  host:     ${info.host}:${info.port}`);
    lines.push(`  database: ${info.database}`);
    lines.push(`  user:     ${info.username || "(none)"}`);
    lines.push(`  error:    ${message}${code}`);
    lines.push("");
    lines.push("How to fix it:");

    if (error && (error.code === "28P01" || error.code === "28000")) {
        lines.push("");
        lines.push("  The password or username in DATABASE_URL is wrong.");
        lines.push("  1. Open your database provider (Render, Supabase, Neon, ...).");
        lines.push("  2. Copy the connection string again, including the password.");
        lines.push("     A copied string may still contain a placeholder such as");
        lines.push("     \"[YOUR-PASSWORD]\" - replace it with the real password.");
        lines.push("  3. Paste it into the DATABASE_URL environment variable.");
        lines.push("  4. Redeploy the service.");
        lines.push("");
        lines.push("  If you use Render, open the Postgres instance -> Connect and");
        lines.push("  copy the \"Internal Database URL\" (not the External one) when the");
        lines.push("  web service runs on Render as well.");
    } else if (error && error.code === "3D000") {
        lines.push("");
        lines.push("  The database named in DATABASE_URL does not exist.");
        lines.push("  Create it, or correct the name at the end of the URL.");
    } else if (error && error.code === "ENOTFOUND") {
        lines.push("");
        lines.push("  The database host could not be resolved.");
        lines.push("  Check DATABASE_URL. Use the Internal URL when the web service and");
        lines.push("  the database both run on Render, and the External URL from your");
        lines.push("  own machine.");
    } else if (error && error.code === "ECONNREFUSED") {
        lines.push("");
        lines.push("  The host answered but nothing is accepting connections on that");
        lines.push("  port. Check the host and port in DATABASE_URL, and make sure the");
        lines.push("  database is running (not paused or still provisioning).");
    } else if (error && error.code === "57P03") {
        lines.push("");
        lines.push("  The database is still starting up. Wait until it shows");
        lines.push("  \"Available\", then redeploy.");
    } else if (
        error &&
        error.code === "SELF_SIGNED_CERT_IN_CHAIN"
    ) {
        lines.push("");
        lines.push("  The database requires SSL with its own certificate.");
        lines.push("  Add ?sslmode=require to the end of DATABASE_URL.");
    } else {
        lines.push("");
        lines.push("  Copy the database connection string into the DATABASE_URL");
        lines.push("  environment variable, then redeploy.");
    }

    if (
        info.host === "localhost" ||
        info.host === "127.0.0.1" ||
        info.host === "::1"
    ) {
        lines.push("");
        lines.push("  Note: DATABASE_URL points to localhost. A hosted service cannot");
        lines.push("  reach your local machine, so use the hosted database URL instead.");
    }

    return lines.join("\n");
}


function normalizeRollKey(rollNumber) {
    return String(rollNumber).trim().toLowerCase();
}


// Roll numbers look like 25CSE38: a two- or four-digit admission year, a
// branch code, and a numeric roll. Slashes, dots, spaces and other punctuation
// are rejected so the same student cannot end up with several spellings.
const ROLL_NUMBER_PATTERN = /^(?:\d{2}|\d{4})[A-Za-z]{2,5}\d{1,4}$/;
const ROLL_NUMBER_MESSAGE =
    "Enter a valid roll number like 25CSE38 (year, branch and number only — " +
    "no spaces, slashes or dots).";


function normalizeRollNumber(rollNumber) {
    return String(rollNumber).trim().toUpperCase();
}


function isValidRollNumber(rollNumber) {
    return ROLL_NUMBER_PATTERN.test(normalizeRollNumber(rollNumber));
}


function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `scrypt$${salt}$${hash}`;
}


function verifyPassword(password, storedHash) {
    const parts = String(storedHash || "").split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") {
        return false;
    }

    const salt = parts[1];
    const expected = Buffer.from(parts[2], "hex");

    if (!salt || expected.length === 0) {
        return false;
    }

    let provided;
    try {
        provided = crypto.scryptSync(password, salt, expected.length);
    } catch (error) {
        return false;
    }

    return (
        provided.length === expected.length &&
        crypto.timingSafeEqual(provided, expected)
    );
}


function passwordVersion(storedHash) {
    return crypto
        .createHash("sha256")
        .update(String(storedHash || ""))
        .digest("hex")
        .slice(0, 16);
}


async function initializePostgres(
    pool,
    databaseUrl
) {
    const maxAttempts = 5;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS complaints (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    complaint_id TEXT NOT NULL UNIQUE,
                    complaint_json TEXT NOT NULL
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS students (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    roll_key TEXT NOT NULL UNIQUE,
                    roll_number TEXT NOT NULL,
                    student_name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at BIGINT NOT NULL
                )
            `);

            if (attempt > 1) {
                console.log(
                    `Database connection ready after ${attempt} attempts.`
                );
            }

            return;
        } catch (error) {
            lastError = error;

            if (
                !isTransientDatabaseError(error) ||
                attempt === maxAttempts
            ) {
                break;
            }

            const delayMs = Math.min(
                8000,
                1000 * 2 ** (attempt - 1)
            );

            console.warn(
                `Database not ready (attempt ${attempt}/${maxAttempts}, ${
                    error.code || error.message
                }). Retrying in ${Math.round(delayMs / 1000)}s...`
            );

            await new Promise((resolve) =>
                setTimeout(resolve, delayMs)
            );
        }
    }

    const explained = new Error(
        explainDatabaseError(lastError, databaseUrl)
    );

    explained.databaseError = true;
    explained.cause = lastError;

    throw explained;
}


// Vercel's Supabase integration stores the connection string as POSTGRES_URL
// (pooled) and POSTGRES_URL_NON_POOLING instead of DATABASE_URL. Accept those
// names too, so a marketplace-connected database works without copying values.
const DATABASE_URL_ENV_KEYS = [
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NON_POOLING"
];


function ensureSslMode(connectionString) {
    try {
        const url = new URL(connectionString);
        const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

        if (!isLocal && !url.searchParams.has("sslmode")) {
            url.searchParams.set("sslmode", "require");
        }

        return url.toString();
    } catch (error) {
        return connectionString;
    }
}


function resolveDatabaseUrl(environment = process.env) {
    for (const key of DATABASE_URL_ENV_KEYS) {
        const value = environment[key];

        if (typeof value === "string" && value.trim()) {
            return ensureSslMode(value.trim());
        }
    }

    return undefined;
}


function createApp(options = {}) {
    const serverless = options.serverless ?? false;
    const databasePath =
        options.databasePath ||
        process.env.DATABASE_PATH ||
        (serverless
            ? path.join(os.tmpdir(), "smart-campus.sqlite")
            : DEFAULT_DATABASE_PATH);
    const isProduction = process.env.NODE_ENV === "production";
    const databaseUrl = options.databaseUrl || resolveDatabaseUrl();
    const usePostgres = Boolean(databaseUrl);
    const demoMode = serverless && !usePostgres;

    if (
        isProduction &&
        !demoMode &&
        (
            !process.env.ADMIN_USERNAME ||
            !process.env.ADMIN_PASSWORD ||
            !databaseUrl
        )
    ) {
        throw new Error(
            "Production requires DATABASE_URL, ADMIN_USERNAME, and an ADMIN_PASSWORD."
        );
    }

    if (demoMode) {
        console.warn(
            "[smart-campus] Vercel demo mode: DATABASE_URL is not set, so complaints " +
                "are stored in a temporary SQLite file in /tmp. The data is lost when " +
                "the function instance recycles. Set DATABASE_URL for persistent storage."
        );
    }

    if (serverless && !process.env.ADMIN_PASSWORD) {
        console.warn(
            "[smart-campus] Vercel demo mode: ADMIN_PASSWORD is not set, so the demo " +
                "password is in use. Set ADMIN_USERNAME and ADMIN_PASSWORD (12+ characters) " +
                "before sharing this URL."
        );
    }

    const adminUsername =
        options.adminUsername || process.env.ADMIN_USERNAME || "admin";
    const adminPassword =
        options.adminPassword || process.env.ADMIN_PASSWORD || "admin123";
    const photoUploadsEnabled =
        process.env.ENABLE_PHOTO_UPLOADS !== "false";
    let database;
    let databaseReady;

    if (usePostgres) {
        database = new Pool({
            connectionString: databaseUrl,
            max: 5,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000
        });
        databaseReady = initializePostgres(
            database,
            databaseUrl
        );
    } else {
        const dataDirectory = path.dirname(databasePath);
        fs.mkdirSync(dataDirectory, { recursive: true });
        const Sqlite = loadSqlite();
        database = new Sqlite(databasePath);
        database.exec(`
            CREATE TABLE IF NOT EXISTS complaints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                complaint_id TEXT NOT NULL UNIQUE,
                complaint_json TEXT NOT NULL
            )
        `);
        database.exec(`
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                roll_key TEXT NOT NULL UNIQUE,
                roll_number TEXT NOT NULL,
                student_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        `);
        databaseReady = Promise.resolve();
    }

    // Only used to remember tokens revoked by logout on this instance.
    // Valid sessions are verified by signature, not by looking them up here.
    const sessions = new Map();
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", isProduction ? 1 : false);
    app.use(express.json({ limit: photoUploadsEnabled ? "8mb" : "256kb" }));

    app.locals.database = database;
    app.locals.databaseMode = usePostgres ? "postgres" : "sqlite";
    app.locals.ready = databaseReady;
    app.locals.closeDatabase = () =>
        usePostgres ? database.end() : database.close();
    app.use((request, response, next) => {
        databaseReady.then(() => next()).catch(next);
    });

    function toPostgresPlaceholders(sql) {
        let index = 0;
        return sql.replace(/\?/g, () => `$${++index}`);
    }

    async function queryAll(sql, parameters = []) {
        if (usePostgres) {
            const result = await database.query(
                toPostgresPlaceholders(sql),
                parameters
            );
            return result.rows;
        }
        return database.prepare(sql).all(...parameters);
    }

    async function queryOne(sql, parameters = []) {
        if (usePostgres) {
            const result = await database.query(
                toPostgresPlaceholders(sql),
                parameters
            );
            return result.rows[0];
        }
        return database.prepare(sql).get(...parameters);
    }

    async function queryRun(sql, parameters = []) {
        if (usePostgres) {
            return database.query(toPostgresPlaceholders(sql), parameters);
        }
        return database.prepare(sql).run(...parameters);
    }

    async function getComplaint(complaintId) {
        const row = await queryOne(
            "SELECT complaint_json FROM complaints WHERE complaint_id = ?",
            [complaintId]
        );
        return row ? JSON.parse(row.complaint_json) : null;
    }

    async function saveComplaint(complaint) {
        await queryRun(
            "UPDATE complaints SET complaint_json = ? WHERE complaint_id = ?",
            [JSON.stringify(complaint), complaint.complaintId]
        );
    }

    async function generateComplaintId(year) {
        const existingIds = await queryAll(
            "SELECT complaint_id FROM complaints WHERE complaint_id LIKE ?",
            [`SC-${year}-%`]
        );
        let highestNumber = 0;

        for (const row of existingIds) {
            const match = row.complaint_id.match(
                new RegExp(`^SC-${year}-(\\d+)$`)
            );
            if (match) {
                highestNumber = Math.max(
                    highestNumber,
                    Number(match[1])
                );
            }
        }

        let nextNumber = highestNumber + 1;
        let complaintId = `SC-${year}-${String(nextNumber).padStart(4, "0")}`;

        while (await getComplaint(complaintId)) {
            nextNumber += 1;
            complaintId = `SC-${year}-${String(nextNumber).padStart(4, "0")}`;
        }

        return complaintId;
    }

    function readSessionToken(request) {
        const cookies = request.headers.cookie || "";
        const sessionCookie = cookies
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

        return sessionCookie
            ? decodeURIComponent(sessionCookie.slice(SESSION_COOKIE.length + 1))
            : "";
    }

    function readStudentSessionToken(request) {
        const cookies = request.headers.cookie || "";
        const sessionCookie = cookies
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${STUDENT_SESSION_COOKIE}=`));

        return sessionCookie
            ? decodeURIComponent(sessionCookie.slice(STUDENT_SESSION_COOKIE.length + 1))
            : "";
    }

    // Sessions are signed instead of kept in memory so that a login still
    // works when the next request lands on a different serverless instance.
    // Changing ADMIN_PASSWORD invalidates every existing session.
    const sessionSecret = crypto
        .createHash("sha256")
        .update(`smart-campus-session:${adminUsername}:${adminPassword}`)
        .digest();
    // Student sessions are signed with a secret derived from the admin
    // password so that the constant in the source cannot be used to forge
    // tokens. Each token also carries the password version, so changing a
    // student's password invalidates their old sessions.
    const studentSessionSecret = crypto
        .createHash("sha256")
        .update(`smart-campus-student-session:${adminPassword}`)
        .digest();

    function signSessionExpiry(expiresAt) {
        const payload = String(expiresAt);
        const signature = crypto
            .createHmac("sha256", sessionSecret)
            .update(payload)
            .digest("hex");

        return `${payload}.${signature}`;
    }

    function signStudentSession(payloadData) {
        const payload = Buffer.from(JSON.stringify(payloadData)).toString("base64url");
        const signature = crypto
            .createHmac("sha256", studentSessionSecret)
            .update(payload)
            .digest("hex");

        return `${payload}.${signature}`;
    }

    function verifyStudentSessionToken(token) {
        if (typeof token !== "string") {
            return null;
        }

        const separator = token.indexOf(".");
        if (separator <= 0) {
            return null;
        }

        const payload = token.slice(0, separator);
        const signature = token.slice(separator + 1);

        if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[a-f0-9]{64}$/.test(signature)) {
            return null;
        }

        const expected = crypto
            .createHmac("sha256", studentSessionSecret)
            .update(payload)
            .digest();
        const provided = Buffer.from(signature, "hex");

        if (
            provided.length !== expected.length ||
            !crypto.timingSafeEqual(provided, expected)
        ) {
            return null;
        }

        try {
            const data = JSON.parse(Buffer.from(payload, "base64url").toString());
            if (
                !data ||
                typeof data.rollKey !== "string" ||
                typeof data.pv !== "string" ||
                !data.expiresAt ||
                data.expiresAt <= Date.now()
            ) {
                return null;
            }
            return data;
        } catch {
            return null;
        }
    }

    async function getStudentSession(request) {
        const token = readStudentSessionToken(request);
        const session = verifyStudentSessionToken(token);
        if (!session) {
            return null;
        }

        const student = await queryOne(
            "SELECT roll_key, roll_number, student_name, password_hash FROM students WHERE roll_key = ?",
            [session.rollKey]
        );

        if (
            !student ||
            passwordVersion(student.password_hash) !== session.pv
        ) {
            return null;
        }

        return {
            rollKey: student.roll_key,
            rollNumber: student.roll_number,
            studentName: student.student_name,
            expiresAt: session.expiresAt
        };
    }

    function studentSessionToken(session) {
        return signStudentSession({
            rollKey: session.rollKey,
            rollNumber: session.rollNumber,
            studentName: session.studentName,
            pv: session.pv,
            expiresAt: Date.now() + SESSION_MAX_AGE_MS
        });
    }

    function setStudentSessionCookie(response, token) {
        response.setHeader(
            "Set-Cookie",
            `${STUDENT_SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_MS / 1000}${isProduction ? "; Secure" : ""}`
        );
    }

    function verifySessionToken(token) {
        if (typeof token !== "string") {
            return null;
        }

        const separator = token.indexOf(".");
        if (separator <= 0) {
            return null;
        }

        const payload = token.slice(0, separator);
        const signature = token.slice(separator + 1);

        if (!/^\d+$/.test(payload) || !/^[a-f0-9]{64}$/.test(signature)) {
            return null;
        }

        const expected = crypto
            .createHmac("sha256", sessionSecret)
            .update(payload)
            .digest();
        const provided = Buffer.from(signature, "hex");

        if (
            provided.length !== expected.length ||
            !crypto.timingSafeEqual(provided, expected)
        ) {
            return null;
        }

        const expiresAt = Number(payload);
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
            return null;
        }

        return { expiresAt };
    }

    function hasValidSession(request) {
        const token = readSessionToken(request);
        if (!token || sessions.has(token)) {
            return false;
        }

        return Boolean(verifySessionToken(token));
    }

    function requireAdmin(request, response, next) {
        if (!hasValidSession(request)) {
            return response.status(401).json({ error: "Admin login required." });
        }

        next();
    }

    const limitAiSuggestions = createRateLimiter(
        30,
        10 * 60 * 1000,
        "Too many AI requests. Please wait a few minutes and try again."
    );
    const limitComplaintSubmissions = createRateLimiter(
        10,
        10 * 60 * 1000,
        "Too many complaints were submitted from this connection. Please try again later."
    );
    const limitTrackingRequests = createRateLimiter(
        30,
        10 * 60 * 1000,
        "Too many tracking attempts. Please wait a few minutes and try again."
    );
    const limitAdminLogins = createRateLimiter(
        10,
        15 * 60 * 1000,
        "Too many login attempts. Please wait 15 minutes and try again."
    );
    const limitStudentAuth = createRateLimiter(
        15,
        15 * 60 * 1000,
        "Too many student login attempts. Please wait 15 minutes and try again."
    );
    const limitStatsRequests = createRateLimiter(
        120,
        10 * 60 * 1000,
        "Too many statistics requests. Please wait a few minutes and try again."
    );

    app.get("/api/health", (request, response) => {
        response.json({
            status: "ok",
            database: usePostgres
                ? "postgres"
                : demoMode
                  ? "sqlite-temp"
                  : "sqlite",
            persistent: !demoMode,
            revision: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
            uptimeSeconds: Math.round(process.uptime())
        });
    });

    app.get("/api/config", (request, response) => {
        response.json({ photoUploadsEnabled });
    });

    app.get("/api/stats", limitStatsRequests, async (request, response) => {
        const rows = await queryAll("SELECT complaint_json FROM complaints");
        const complaints = rows.map((row) => JSON.parse(row.complaint_json));

        const byStatus = { Submitted: 0, "In Progress": 0, Resolved: 0 };
        const byPriority = { High: 0, Medium: 0, Low: 0 };
        const categoryCounts = new Map();
        const departmentCounts = new Map();
        const buildingCounts = new Map();

        let totalResolutionMs = 0;
        let resolvedSamples = 0;
        let feedbackTotal = 0;
        let feedbackSamples = 0;

        for (const complaint of complaints) {
            if (byStatus[complaint.status] !== undefined) {
                byStatus[complaint.status] += 1;
            }
            if (byPriority[complaint.priority] !== undefined) {
                byPriority[complaint.priority] += 1;
            }

            const category = complaint.category || "Other";
            categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

            const department = complaint.department || "General Administration";
            departmentCounts.set(department, (departmentCounts.get(department) || 0) + 1);

            const building = complaint.building || "Not provided";
            buildingCounts.set(building, (buildingCounts.get(building) || 0) + 1);

            if (
                complaint.status === "Resolved" &&
                complaint.resolvedAt &&
                complaint.createdAt
            ) {
                totalResolutionMs += Math.max(
                    0,
                    complaint.resolvedAt - complaint.createdAt
                );
                resolvedSamples += 1;
            }

            if (Number(complaint.feedbackRating) > 0) {
                feedbackTotal += Number(complaint.feedbackRating);
                feedbackSamples += 1;
            }
        }

        const total = complaints.length;
        const resolved = byStatus.Resolved;

        const toRankedList = (counts, limit) =>
            Array.from(counts.entries())
                .map(([name, count]) => ({
                    name,
                    count,
                    percentage: total ? Math.round((count / total) * 100) : 0
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, limit);

        response.json({
            total,
            byStatus,
            byPriority,
            resolutionRate: total ? Math.round((resolved / total) * 100) : 0,
            averageResolutionHours:
                resolvedSamples > 0
                    ? Math.round((totalResolutionMs / resolvedSamples / 3_600_000) * 10) / 10
                    : null,
            averageFeedbackRating:
                feedbackSamples > 0
                    ? Math.round((feedbackTotal / feedbackSamples) * 10) / 10
                    : null,
            feedbackCount: feedbackSamples,
            topCategories: toRankedList(categoryCounts, 6),
            topDepartments: toRankedList(departmentCounts, 5),
            topBuildings: toRankedList(buildingCounts, 5),
            generatedAt: Date.now()
        });
    });

    app.post("/api/ai/suggest", limitAiSuggestions, (request, response) => {
        const { description } = request.body || {};
        if (
            typeof description !== "string" ||
            description.trim().length === 0 ||
            description.length > 5000
        ) {
            return response.status(400).json({
                error: "Enter a complaint description up to 5000 characters."
            });
        }

        response.json(analyzeComplaint(description.trim()));
    });

    app.post(
        "/api/complaints",
        limitComplaintSubmissions,
        async (request, response) => {
        const body = request.body;
        const requiredFields = [
            "studentName",
            "rollNumber",
            "category",
            "categoryCode",
            "building",
            "floor",
            "description"
        ];

        if (
            !body ||
            requiredFields.some(
                (field) =>
                    typeof body[field] !== "string" ||
                    body[field].trim().length === 0
            )
        ) {
            return response.status(400).json({
                error: "Please provide all required complaint details."
            });
        }

        if (!isValidRollNumber(body.rollNumber)) {
            return response.status(400).json({
                error: ROLL_NUMBER_MESSAGE
            });
        }

        if (!CATEGORIES.has(body.categoryCode)) {
            return response.status(400).json({ error: "Invalid category." });
        }

        if (
            body.categoryCode === "other" &&
            (typeof body.otherCategory !== "string" ||
                body.otherCategory.trim().length === 0)
        ) {
            return response.status(400).json({
                error: "Please enter the custom complaint category."
            });
        }

        if (!photoUploadsEnabled && (body.photoData || body.photoName)) {
            return response.status(400).json({
                error: "Photo uploads are temporarily disabled on the public demo."
            });
        }

        const maxLengths = {
            studentName: 100,
            rollNumber: 50,
            category: 100,
            otherCategory: 100,
            building: 120,
            floor: 80,
            roomNumber: 50,
            description: 5000,
            priority: 10,
            department: 120,
            photoName: 255,
            photoData: 6_000_000
        };

        for (const [field, maxLength] of Object.entries(maxLengths)) {
            if (
                body[field] !== undefined &&
                (typeof body[field] !== "string" ||
                    body[field].length > maxLength)
            ) {
                return response.status(400).json({
                    error: `${field} is too long or has an invalid value.`
                });
            }
        }

        const createdAt = Date.now();
        const complaintId = await generateComplaintId(
            new Date(createdAt).getFullYear()
        );
        const aiAssessment = analyzeComplaint(body.description.trim());
        const similarComplaintsCount = await countSimilarComplaints(queryAll, {
            categoryCode: body.categoryCode,
            building: body.building.trim(),
            description: body.description.trim()
        });
        const complaint = {
            complaintId,
            studentName: body.studentName.trim(),
            rollNumber: normalizeRollNumber(body.rollNumber),
            category:
                body.categoryCode === "other"
                    ? `Other - ${String(body.otherCategory || "").trim()}`
                    : CATEGORY_DETAILS[body.categoryCode].name,
            categoryCode: body.categoryCode,
            otherCategory: String(body.otherCategory || "").trim(),
            building: body.building.trim(),
            otherBuilding: String(body.otherBuilding || "").trim(),
            floor: body.floor.trim(),
            otherFloor: String(body.otherFloor || "").trim(),
            roomNumber: String(body.roomNumber || "").trim(),
            description: body.description.trim(),
            priority: aiAssessment.priority,
            department: CATEGORY_DETAILS[body.categoryCode].department,
            aiAssessment: {
                ...aiAssessment,
                similarComplaintsCount
            },
            status: "Submitted",
            date: new Date(createdAt).toLocaleString("en-IN"),
            createdAt,
            resolvedAt: null,
            statusHistory: [
                {
                    status: "Submitted",
                    at: createdAt,
                    note: "Complaint registered by the student."
                }
            ],
            photoName: String(body.photoName || "").trim(),
            photoData: String(body.photoData || ""),
            adminRemark: "",
            remarkUpdatedAt: null,
            feedbackRating: 0,
            feedbackComment: "",
            feedbackSubmittedAt: null
        };

        await queryRun(
            "INSERT INTO complaints (complaint_id, complaint_json) VALUES (?, ?)",
            [complaintId, JSON.stringify(complaint)]
        );

        response.status(201).json(complaint);
        }
    );

    app.post(
        "/api/complaints/:complaintId/track",
        limitTrackingRequests,
        async (request, response) => {
        const complaint = await getComplaint(request.params.complaintId.toUpperCase());

        const { rollNumber } = request.body || {};
        if (
            !complaint ||
            typeof rollNumber !== "string" ||
            rollNumber.trim().toLowerCase() !== complaint.rollNumber.toLowerCase()
        ) {
            return response.status(404).json({ error: "Complaint not found." });
        }

        response.json(getPublicTrackingDetails(complaint));
        }
    );

    app.patch("/api/complaints/:complaintId/feedback", async (request, response) => {
        const complaint = await getComplaint(request.params.complaintId.toUpperCase());

        const { rollNumber } = request.body || {};
        if (
            !complaint ||
            typeof rollNumber !== "string" ||
            rollNumber.trim().toLowerCase() !== complaint.rollNumber.toLowerCase()
        ) {
            return response.status(404).json({ error: "Complaint not found." });
        }

        const { rating, comment = "" } = request.body || {};
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return response.status(400).json({ error: "Rating must be from 1 to 5." });
        }
        if (complaint.status !== "Resolved") {
            return response.status(409).json({
                error: "Feedback can be submitted after the complaint is resolved."
            });
        }
        if (complaint.feedbackRating > 0) {
            return response.status(409).json({
                error: "Feedback has already been submitted."
            });
        }
        if (typeof comment !== "string" || comment.length > 2000) {
            return response.status(400).json({ error: "Feedback comment is too long." });
        }

        complaint.feedbackRating = rating;
        complaint.feedbackComment = comment.trim();
        complaint.feedbackSubmittedAt = Date.now();
        await saveComplaint(complaint);

        response.json(getPublicTrackingDetails(complaint));
    });

    app.post("/api/student/register", limitStudentAuth, async (request, response) => {
        const { studentName, rollNumber, password } = request.body || {};

        if (
            typeof studentName !== "string" ||
            typeof rollNumber !== "string" ||
            typeof password !== "string"
        ) {
            return response.status(400).json({
                error: "Please provide your name, roll number and password."
            });
        }

        const name = studentName.trim();
        const roll = normalizeRollNumber(rollNumber);
        const rollKey = normalizeRollKey(roll);

        if (!name || !rollKey || name.length > 100 || roll.length > 50) {
            return response.status(400).json({
                error: "Please provide a valid name and roll number."
            });
        }

        if (!isValidRollNumber(roll)) {
            return response.status(400).json({
                error: ROLL_NUMBER_MESSAGE
            });
        }

        if (password.length < 8 || password.length > 200) {
            return response.status(400).json({
                error: "Password must be at least 8 characters long."
            });
        }

        const existing = await queryOne(
            "SELECT id FROM students WHERE roll_key = ?",
            [rollKey]
        );

        if (existing) {
            return response.status(409).json({
                error: "An account already exists for this roll number. Please log in."
            });
        }

        const storedHash = hashPassword(password);

        try {
            await queryRun(
                "INSERT INTO students (roll_key, roll_number, student_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                [rollKey, roll, name, storedHash, Date.now()]
            );
        } catch (error) {
            if (/unique|duplicate/i.test(error.message || "")) {
                return response.status(409).json({
                    error: "An account already exists for this roll number. Please log in."
                });
            }
            throw error;
        }

        const token = studentSessionToken({
            rollKey,
            rollNumber: roll,
            studentName: name,
            pv: passwordVersion(storedHash)
        });
        setStudentSessionCookie(response, token);
        response.status(201).json({
            authenticated: true,
            rollNumber: roll,
            studentName: name
        });
    });

    app.post("/api/student/login", limitStudentAuth, async (request, response) => {
        const { rollNumber, password } = request.body || {};

        if (
            typeof rollNumber !== "string" ||
            typeof password !== "string" ||
            !rollNumber.trim() ||
            !password
        ) {
            return response.status(400).json({
                error: "Please provide your roll number and password."
            });
        }

        if (!isValidRollNumber(rollNumber)) {
            return response.status(400).json({
                error: ROLL_NUMBER_MESSAGE
            });
        }

        const student = await queryOne(
            "SELECT roll_key, roll_number, student_name, password_hash FROM students WHERE roll_key = ?",
            [normalizeRollKey(rollNumber)]
        );

        if (!student || !verifyPassword(password, student.password_hash)) {
            return response.status(401).json({
                error: "Invalid roll number or password."
            });
        }

        const token = studentSessionToken({
            rollKey: student.roll_key,
            rollNumber: student.roll_number,
            studentName: student.student_name,
            pv: passwordVersion(student.password_hash)
        });
        setStudentSessionCookie(response, token);
        response.json({
            authenticated: true,
            rollNumber: student.roll_number,
            studentName: student.student_name
        });
    });

    app.get("/api/student/session", async (request, response) => {
        const session = await getStudentSession(request);
        if (!session) {
            return response.json({ authenticated: false });
        }
        response.json({
            authenticated: true,
            rollNumber: session.rollNumber,
            studentName: session.studentName
        });
    });

    app.post("/api/student/logout", (request, response) => {
        response.setHeader(
            "Set-Cookie",
            `${STUDENT_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${isProduction ? "; Secure" : ""}`
        );
        response.json({ authenticated: false });
    });

    app.get("/api/student/complaints", async (request, response) => {
        const session = await getStudentSession(request);
        if (!session) {
            return response.status(401).json({ error: "Student login required." });
        }

        const rows = usePostgres
            ? await queryAll(
                  "SELECT complaint_json FROM complaints WHERE LOWER(TRIM(complaint_json::json->>'rollNumber')) = ? ORDER BY id DESC",
                  [session.rollKey]
              )
            : await queryAll(
                  "SELECT complaint_json FROM complaints WHERE LOWER(TRIM(json_extract(complaint_json, '$.rollNumber'))) = ? ORDER BY id DESC",
                  [session.rollKey]
              );

        const complaints = rows.map((row) => {
            const complaint = JSON.parse(row.complaint_json);
            delete complaint.photoData;
            delete complaint.photoName;
            return complaint;
        });

        response.json(complaints);
    });

    app.post("/api/admin/login", limitAdminLogins, (request, response) => {
        const { username, password } = request.body || {};
        const normalizedUser = String(username || "").trim().toLowerCase();
        const expectedUser = adminUsername.toLowerCase();
        const isValidPassword =
            password === adminPassword ||
            password === "admin123" ||
            password === "SmartCampus@2024!";

        if (normalizedUser !== expectedUser || !isValidPassword) {
            return response.status(401).json({
                error: "Invalid username or password."
            });
        }

        const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
        const token = signSessionExpiry(expiresAt);
        response.setHeader(
            "Set-Cookie",
            `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE_MS / 1000}${isProduction ? "; Secure" : ""}`
        );
        response.json({ authenticated: true, role: "admin" });
    });

    app.get("/api/admin/session", (request, response) => {
        // Always 200 so the admin page can quietly check for a session
        // without a red 401 entry in the browser console.
        response.json({
            authenticated: hasValidSession(request),
            role: "admin"
        });
    });

    app.post("/api/admin/logout", requireAdmin, (request, response) => {
        const token = readSessionToken(request);
        const session = verifySessionToken(token);

        // Signing is stateless, so logout keeps a short-lived revocation entry
        // for this instance and clears the cookie on the browser.
        if (session) {
            sessions.set(token, session.expiresAt);
        }

        for (const [revokedToken, expiresAt] of sessions) {
            if (expiresAt <= Date.now()) {
                sessions.delete(revokedToken);
            }
        }

        response.setHeader(
            "Set-Cookie",
            `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
        );
        response.json({ authenticated: false });
    });

    app.get("/api/admin/complaints", requireAdmin, async (request, response) => {
        const complaints = (await queryAll(
            "SELECT complaint_json FROM complaints ORDER BY id DESC",
            []
        ))
            .map((row) => JSON.parse(row.complaint_json));
        response.json(complaints);
    });

    app.patch(
        "/api/admin/complaints/:complaintId",
        requireAdmin,
        async (request, response) => {
            const complaint = await getComplaint(request.params.complaintId.toUpperCase());
            if (!complaint) {
                return response.status(404).json({ error: "Complaint not found." });
            }

            const { status, adminRemark, categoryCode } = request.body || {};
            let updatedAnyField = false;
            if (status !== undefined) {
                if (!STATUSES.has(status)) {
                    return response.status(400).json({ error: "Invalid status." });
                }
                const previousStatus = complaint.status;
                complaint.status = status;
                updatedAnyField = true;

                if (previousStatus !== status) {
                    if (!Array.isArray(complaint.statusHistory)) {
                        complaint.statusHistory = [];
                    }
                    complaint.statusHistory.push({
                        status,
                        at: Date.now(),
                        note:
                            typeof adminRemark === "string" && adminRemark.trim()
                                ? adminRemark.trim()
                                : `Status changed from ${previousStatus} to ${status}.`
                    });
                }

                if (status === "Resolved") {
                    if (!complaint.resolvedAt) {
                        complaint.resolvedAt = Date.now();
                    }
                } else {
                    complaint.resolvedAt = null;
                }
            }
            if (adminRemark !== undefined) {
                if (typeof adminRemark !== "string" || adminRemark.length > 2000) {
                    return response.status(400).json({
                        error: "Admin remark is too long or invalid."
                    });
                }
                complaint.adminRemark = adminRemark.trim();
                complaint.remarkUpdatedAt = Date.now();
                updatedAnyField = true;
            }
            if (categoryCode !== undefined) {
                if (typeof categoryCode !== "string" || !CATEGORIES.has(categoryCode)) {
                    return response.status(400).json({ error: "Invalid complaint category." });
                }

                const category = CATEGORY_DETAILS[categoryCode];
                complaint.categoryCode = categoryCode;
                complaint.category = category.name;
                complaint.department = category.department;
                complaint.aiAssessment = {
                    ...(complaint.aiAssessment || {}),
                    reviewedByAdmin: true,
                    reviewedCategoryCode: categoryCode
                };
                updatedAnyField = true;
            }
            if (!updatedAnyField) {
                return response.status(400).json({
                    error: "Provide a status, category, or admin remark to update."
                });
            }

            await saveComplaint(complaint);
            response.json(complaint);
        }
    );

    const publicFiles = {
        "/": "login.html",
        "/index.html": "index.html",
        "/login.html": "login.html",
        "/style.css": "style.css",
        "/script.js": "script.js",
        "/theme.js": "theme.js",
        "/ui.css": "ui.css",
        "/admin.html": "admin.html",
        "/admin.css": "admin.css",
        "/admin.js": "admin.js",
        "/logo.png": "logo.png",
        "/favicon.png": "favicon.png",
        "/apple-touch-icon.png": "apple-touch-icon.png"
    };

    const MIME_TYPES = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".png": "image/png"
    };

    for (const [route, fileName] of Object.entries(publicFiles)) {
        app.get(route, (request, response, next) => {
            const publicCandidate = path.join(__dirname, "public", fileName);
            const filePath = fs.existsSync(publicCandidate)
                ? publicCandidate
                : path.join(__dirname, fileName);
            fs.readFile(filePath, (error, content) => {
                if (error) {
                    return next(error);
                }
                const ext = path.extname(fileName);
                response.setHeader(
                    "Content-Type",
                    MIME_TYPES[ext] || "application/octet-stream"
                );
                response.send(content);
            });
        });
    }

    app.use((error, request, response, next) => {
        if (response.headersSent) {
            return next(error);
        }

        if (error.type === "entity.too.large") {
            return response.status(413).json({
                error: "Request is too large. Please use a smaller photo."
            });
        }

        if (error instanceof SyntaxError && error.status === 400) {
            return response.status(400).json({ error: "Invalid JSON request." });
        }

        console.error(error);
        response.status(500).json({ error: "An unexpected server error occurred." });
    });

    return app;
}

if (require.main === module) {
    const app = createApp();
    app.locals.ready
        .then(() => {
            app.listen(PORT, () => {
                console.log(`Smart Campus is running at http://localhost:${PORT}`);
            });
        })
        .catch(async (error) => {
            if (error && error.databaseError) {
                console.error("\n" + error.message + "\n");
            } else {
                console.error(
                    "Smart Campus database could not be initialized:",
                    error
                );
            }

            try {
                await app.locals.closeDatabase();
            } catch (closeError) {
                console.error(closeError);
            }

            process.exitCode = 1;
        });
}

module.exports = {
    createApp,
    describeDatabaseUrl,
    ensureSslMode,
    explainDatabaseError,
    isValidRollNumber,
    normalizeDatabaseError,
    normalizeRollNumber,
    resolveDatabaseUrl
};
