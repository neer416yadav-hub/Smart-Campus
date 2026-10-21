// ==========================================
// SMART CAMPUS - STUDENT PAGE
// ==========================================

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

document.addEventListener("DOMContentLoaded", function () {

    setupOtherOptions();
    setupAiSuggestion();
    setupPhotoUploadAvailability();
    setupComplaintForm();
    setupTracking();

});

async function setupPhotoUploadAvailability() {
    const photo = document.getElementById("photo");
    const notice = document.getElementById("photoUploadNotice");
    const help = document.getElementById("photoUploadHelp");
    if (!photo || !notice || !help) {
        return;
    }

    try {
        const config = await requestApi("/api/config");
        photo.disabled = !config.photoUploadsEnabled;
        notice.hidden = config.photoUploadsEnabled;
        notice.textContent = config.photoUploadsEnabled
            ? ""
            : "Photo uploads are temporarily disabled for this public demo.";
        help.hidden = !config.photoUploadsEnabled;
    } catch (error) {
        console.error(error);
        photo.disabled = true;
        notice.textContent =
            "Photo upload availability could not be checked, so uploads are disabled.";
        help.hidden = true;
    }
}


// ==========================================
// OTHER OPTIONS
// ==========================================

function setupOtherOptions() {

    const category = document.getElementById("category");
    const building = document.getElementById("building");
    const floor = document.getElementById("floor");

    if (category) {

        createOtherInput(
            category,
            "otherCategory",
            "Enter your complaint category"
        );

    }

    if (building) {

        createOtherInput(
            building,
            "otherBuilding",
            "Enter building / section name"
        );

    }

    if (floor) {

        createOtherInput(
            floor,
            "otherFloor",
            "Enter floor name"
        );

    }

}


// ==========================================
// LOCAL AI SUGGESTION
// ==========================================

function setupAiSuggestion() {
    const description = document.getElementById("description");
    const button = document.getElementById("aiSuggestButton");
    const result = document.getElementById("aiSuggestion");

    if (!description || !button || !result) {
        return;
    }

    let currentSuggestion = null;

    description.addEventListener("input", function () {
        currentSuggestion = null;
        result.hidden = true;
        result.textContent = "";
    });

    button.addEventListener("click", async function () {
        const text = description.value.trim();
        if (!text) {
            result.textContent = "Write a complaint first, then ask AI for a suggestion.";
            result.hidden = false;
            return;
        }

        button.disabled = true;
        button.textContent = "Checking complaint...";
        result.hidden = true;

        try {
            currentSuggestion = await requestApi("/api/ai/suggest", {
                method: "POST",
                body: JSON.stringify({ description: text })
            });

            result.textContent = currentSuggestion.needsReview
                ? `AI is not confident enough to choose a category (${currentSuggestion.confidence}% confidence). Please choose a category manually. `
                : `AI category: ${currentSuggestion.category} ` +
                  `(${currentSuggestion.confidence}% confidence). ` +
                  `Suggested team: ${currentSuggestion.department}. `;
            result.textContent +=
                `Priority: ${currentSuggestion.priority}. ` +
                `Quick summary: ${currentSuggestion.summary} ` +
                (
                    currentSuggestion.needsReview
                        ? ""
                        : currentSuggestion.reason
                );

            if (currentSuggestion.emergency) {
                result.textContent +=
                    " This is only an AI warning; contact campus emergency staff directly if anyone is in immediate danger.";
            }

            const applyButton = document.createElement("button");
            applyButton.type = "button";
            applyButton.className = "ai-apply-button";
            applyButton.textContent = currentSuggestion.needsReview
                ? "AI category unavailable"
                : "Use suggested category";
            applyButton.disabled = currentSuggestion.needsReview;
            applyButton.addEventListener("click", function () {
                const category = document.getElementById("category");
                category.value = currentSuggestion.categoryCode;
                category.dispatchEvent(new Event("change"));
                applyButton.textContent = "Suggestion applied";
                applyButton.disabled = true;
            });
            result.appendChild(document.createElement("br"));
            result.appendChild(applyButton);

            result.hidden = false;
        } catch (error) {
            console.error(error);
            result.textContent = `AI suggestion is unavailable: ${error.message}`;
            result.hidden = false;
        } finally {
            button.disabled = false;
            button.textContent = "Get free AI suggestion";
        }
    });

}


// ==========================================
// CREATE OTHER INPUT
// ==========================================

function createOtherInput(
    select,
    inputId,
    placeholder
) {

    const input = document.createElement("input");

    input.type = "text";
    input.id = inputId;
    input.className = "other-input";
    input.placeholder = placeholder;

    input.style.display = "none";

    select.insertAdjacentElement(
        "afterend",
        input
    );


    select.addEventListener(
        "change",
        function () {

            if (
                String(this.value)
                    .trim()
                    .toLowerCase() === "other"
            ) {

                input.style.display = "block";
                input.required = true;

            } else {

                input.style.display = "none";
                input.required = false;
                input.value = "";

            }

        }
    );

}


// ==========================================
// COMPLAINT FORM
// ==========================================

function setupComplaintForm() {

    const form =
        document.getElementById(
            "complaintForm"
        );

    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const studentName =
                document.getElementById(
                    "studentName"
                ).value.trim();


            const rollNumber =
                document.getElementById(
                    "rollNumber"
                ).value.trim();


            const categoryCode =
                document.getElementById(
                    "category"
                ).value;


            const buildingValue =
                document.getElementById(
                    "building"
                ).value;


            const floorValue =
                document.getElementById(
                    "floor"
                ).value;


            const roomNumber =
                document.getElementById(
                    "roomNumber"
                ).value.trim();


            const description =
                document.getElementById(
                    "description"
                ).value.trim();


            const photoInput =
                document.getElementById(
                    "photo"
                );


            const otherCategory =
                document.getElementById(
                    "otherCategory"
                );


            const otherBuilding =
                document.getElementById(
                    "otherBuilding"
                );


            const otherFloor =
                document.getElementById(
                    "otherFloor"
                );


            const customCategory =
                otherCategory
                    ? otherCategory.value.trim()
                    : "";


            const customBuilding =
                otherBuilding
                    ? otherBuilding.value.trim()
                    : "";


            const customFloor =
                otherFloor
                    ? otherFloor.value.trim()
                    : "";


            if (
                !studentName ||
                !rollNumber ||
                !categoryCode ||
                !buildingValue ||
                !floorValue ||
                !description
            ) {

                alert(
                    "Please fill all required fields."
                );

                return;

            }


            if (
                categoryCode === "other" &&
                !customCategory
            ) {

                alert(
                    "Please enter your custom complaint category."
                );

                return;

            }


            if (
                buildingValue.toLowerCase() === "other" &&
                !customBuilding
            ) {

                alert(
                    "Please enter your custom building / section."
                );

                return;

            }


            if (
                floorValue.toLowerCase() === "other" &&
                !customFloor
            ) {

                alert(
                    "Please enter your custom floor."
                );

                return;

            }


            let photoData = "";
            let photoName = "";


            if (
                photoInput &&
                photoInput.files &&
                photoInput.files[0]
            ) {

                const file =
                    photoInput.files[0];


                if (
                    !file.type.startsWith("image/")
                ) {

                    alert(
                        "Please select a valid image file."
                    );

                    return;

                }


                try {

                    photoData =
                        await compressImage(
                            file
                        );

                    photoName =
                        file.name;

                }
                catch (error) {

                    console.error(error);

                    alert(
                        "Photo could not be processed."
                    );

                    return;

                }

            }


            const category =
                getCategoryDisplay(
                    categoryCode,
                    customCategory
                );


            const building =
                getOtherDisplay(
                    buildingValue,
                    customBuilding
                );


            const floor =
                getOtherDisplay(
                    floorValue,
                    customFloor
                );


            const priority =
                detectPriority(
                    description,
                    categoryCode
                );


            const department =
                assignDepartment(
                    categoryCode
                );


            const complaintData = {

                studentName,

                rollNumber,

                category,

                categoryCode,

                otherCategory:
                    customCategory,

                building,

                otherBuilding:
                    customBuilding,

                floor,

                otherFloor:
                    customFloor,

                roomNumber,

                description,

                priority,

                department,

                status:
                    "Submitted",

                photoName,

                photoData,

                adminRemark:
                    "",

                remarkUpdatedAt:
                    null,

                feedbackRating:
                    0,

                feedbackComment:
                    "",

                feedbackSubmittedAt:
                    null

            };

            let complaint;
            try {
                complaint = await requestApi(
                    "/api/complaints",
                    {
                        method: "POST",
                        body: JSON.stringify(complaintData)
                    }
                );
            } catch (error) {
                console.error(error);
                alert(`Complaint could not be submitted: ${error.message}`);
                return;
            }


            form.reset();


            resetOtherInputs();


            alert(
                "Complaint submitted successfully!\n\n" +
                "Complaint ID: " +
                complaint.complaintId +
                "\nPriority: " +
                complaint.priority +
                "\nDepartment: " +
                complaint.department +
                (
                    complaint.aiAssessment &&
                    complaint.aiAssessment.similarComplaintsCount > 0
                        ? "\nAI found " +
                          complaint.aiAssessment.similarComplaintsCount +
                          " similar recent complaint(s) from this building and category. Admin will review the pattern."
                        : ""
                ) +
                (
                    complaint.aiAssessment &&
                    complaint.aiAssessment.emergency
                        ? "\nAI safety alert: An administrator will review this complaint."
                        : ""
                )
            );


            showComplaintReceipt(
                complaint
            );

        }
    );

}


// ==========================================
// OTHER DISPLAY
// ==========================================

function getOtherDisplay(
    value,
    customValue
) {

    if (
        String(value)
            .trim()
            .toLowerCase() === "other"
    ) {

        return (
            "Other - " +
            customValue
        );

    }

    return value;

}


function getCategoryDisplay(
    categoryCode,
    customValue
) {

    if (
        categoryCode === "other"
    ) {

        return (
            "Other - " +
            customValue
        );

    }


    const names = {

        wifi:
            "Wi-Fi / Internet Issue",

        electrical:
            "Electrical Problem",

        sanitation:
            "Sanitation / Cleanliness",

        infrastructure:
            "Infrastructure Damage",

        classroom:
            "Classroom Problem",

        hostel:
            "Hostel Problem",

        library:
            "Library Problem",

        security:
            "Security Issue",

        water:
            "Water Supply Issue",

        furniture:
            "Furniture Problem",

        transport:
            "Transport Issue",

        other:
            "Other"

    };


    return (
        names[categoryCode] ||
        categoryCode
    );

}


// ==========================================
// RESET OTHER INPUTS
// ==========================================

function resetOtherInputs() {

    [
        "otherCategory",
        "otherBuilding",
        "otherFloor"
    ].forEach(
        function (id) {

            const input =
                document.getElementById(
                    id
                );

            if (input) {

                input.value = "";
                input.style.display = "none";
                input.required = false;

            }

        }
    );

}


// ==========================================
// PRIORITY
// ==========================================

function detectPriority(
    description,
    categoryCode
) {

    const text =
        (
            String(description) +
            " " +
            String(categoryCode)
        )
        .toLowerCase();


    const highKeywords = [

        "fire",
        "smoke",
        "spark",
        "sparks",
        "short circuit",
        "short-circuit",
        "electric shock",
        "electricity shock",
        "current",
        "shock",
        "burnt wire",
        "burned wire",
        "wire burnt",
        "wire burned",
        "wire jal",
        "wire jal gai",
        "wire jal gayi",
        "chingaari",
        "chingari",
        "gas leak",
        "water leakage",
        "flood",
        "danger",
        "dangerous",
        "emergency",
        "accident",
        "injury",
        "unsafe",
        "broken glass",
        "urgent"

    ];


    const mediumKeywords = [

        "not working",
        "broken",
        "damage",
        "damaged",
        "issue",
        "problem",
        "repair",
        "leaking",
        "slow",
        "dirty",
        "kharab",
        "kharaab",
        "toot gaya",
        "toot gai"

    ];


    if (
        highKeywords.some(
            function (word) {
                return text.includes(word);
            }
        )
    ) {

        return "High";

    }


    if (
        mediumKeywords.some(
            function (word) {
                return text.includes(word);
            }
        )
    ) {

        return "Medium";

    }


    return "Low";

}


// ==========================================
// DEPARTMENT
// ==========================================

function assignDepartment(
    categoryCode
) {

    const departments = {

        wifi:
            "IT Department",

        electrical:
            "Electrical Maintenance",

        sanitation:
            "Housekeeping Department",

        infrastructure:
            "Civil / Infrastructure Department",

        classroom:
            "Academic / Maintenance Department",

        hostel:
            "Hostel Administration",

        library:
            "Library Administration",

        security:
            "Security Department",

        water:
            "Water & Maintenance Department",

        furniture:
            "Furniture / Maintenance Department",

        transport:
            "Transport Department",

        other:
            "General Administration"

    };


    return (
        departments[categoryCode] ||
        "General Administration"
    );

}


// ==========================================
// IMAGE COMPRESSION
// ==========================================

function compressImage(
    file
) {

    return new Promise(
        function (resolve, reject) {

            const reader =
                new FileReader();


            reader.onload =
                function (event) {

                    const img =
                        new Image();


                    img.onload =
                        function () {

                            const maxWidth =
                                1000;


                            let width =
                                img.width;


                            let height =
                                img.height;


                            if (
                                width >
                                maxWidth
                            ) {

                                height =
                                    Math.round(
                                        height *
                                        (
                                            maxWidth /
                                            width
                                        )
                                    );

                                width =
                                    maxWidth;

                            }


                            const canvas =
                                document.createElement(
                                    "canvas"
                                );


                            canvas.width =
                                width;

                            canvas.height =
                                height;


                            const context =
                                canvas.getContext(
                                    "2d"
                                );


                            context.drawImage(
                                img,
                                0,
                                0,
                                width,
                                height
                            );


                            resolve(
                                canvas.toDataURL(
                                    "image/jpeg",
                                    0.75
                                )
                            );

                        };


                    img.onerror =
                        reject;


                    img.src =
                        event.target.result;

                };


            reader.onerror =
                reject;


            reader.readAsDataURL(
                file
            );

        }
    );

}


// ==========================================
// TRACKING
// ==========================================

function setupTracking() {

    const button =
        document.getElementById(
            "trackButton"
        );


    const input =
        document.getElementById(
            "trackingId"
        );

    const rollInput =
        document.getElementById(
            "trackingRollNumber"
        );


    if (button) {

        button.addEventListener(
            "click",
            trackComplaint
        );

    }


    [input, rollInput].forEach(function (field) {
        if (!field) {
            return;
        }

        field.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    trackComplaint();

                }
            }
        );

    });

}


// ==========================================
// TRACK COMPLAINT
// ==========================================

async function trackComplaint() {

    const input =
        document.getElementById(
            "trackingId"
        );

    const rollInput =
        document.getElementById(
            "trackingRollNumber"
        );


    const result =
        document.getElementById(
            "trackingResult"
        );


    if (!input || !rollInput || !result) {
        return;
    }


    const id =
        input.value.trim();
    const rollNumber =
        rollInput.value.trim();


    if (!id || !rollNumber) {

        result.innerHTML = `
            <div class="tracking-card">
                Please enter both your Complaint ID and roll number.
            </div>
        `;

        return;

    }


    try {
        const complaint = await requestApi(
            `/api/complaints/${encodeURIComponent(id)}/track`,
            {
                method: "POST",
                body: JSON.stringify({ rollNumber })
            }
        );
        renderTrackingResult(complaint, rollNumber);
    } catch (error) {
        if (error.message === "Complaint not found.") {
            result.innerHTML = `
                <div class="tracking-card">
                    <strong>Complaint not found.</strong>
                    <p>Please check your Complaint ID and try again.</p>
                </div>
            `;
            return;
        }

        console.error(error);
        result.innerHTML = `
            <div class="tracking-card">
                <strong>Could not check the complaint.</strong>
                <p>${safe(error.message)}</p>
                <p>Please make sure the Smart Campus server is running.</p>
            </div>
        `;
    }

}


// ==========================================
// TRACKING RESULT
// ==========================================

function renderTrackingResult(
    complaint,
    rollNumber
) {

    const result =
        document.getElementById(
            "trackingResult"
        );


    const statusClass =
        complaint.status === "Resolved"
            ? "resolved"
            : complaint.status === "In Progress"
                ? "in-progress"
                : "";


    const currentStep =
        complaint.status === "Resolved"
            ? 3
            : complaint.status === "In Progress"
                ? 2
                : 1;


    result.innerHTML = `

        <div class="tracking-card">

            <div class="tracking-header">

                <div>

                    <h3>
                        ${safe(
                            complaint.complaintId
                        )}
                    </h3>

                    <p>Complaint tracking details</p>

                </div>

                <span class="status-badge ${statusClass}">
                    ${safe(
                        complaint.status
                    )}
                </span>

            </div>


            <div class="tracking-timeline">

                <div class="timeline-step ${currentStep >= 1 ? "active" : ""}">

                    <div class="timeline-dot">
                        1
                    </div>

                    <span>
                        Submitted
                    </span>

                </div>


                <div class="timeline-step ${currentStep >= 2 ? "active" : ""}">

                    <div class="timeline-dot">
                        2
                    </div>

                    <span>
                        In Progress
                    </span>

                </div>


                <div class="timeline-step ${currentStep >= 3 ? "active" : ""}">

                    <div class="timeline-dot">
                        3
                    </div>

                    <span>
                        Resolved
                    </span>

                </div>

            </div>


            <div class="tracking-details">

                <div class="tracking-detail">

                    <span>Category</span>

                    <strong>
                        ${safe(
                            complaint.category
                        )}
                    </strong>

                </div>


                <div class="tracking-detail">

                    <span>Priority</span>

                    <strong>
                        ${safe(
                            complaint.priority
                        )}
                    </strong>

                </div>


                <div class="tracking-detail">

                    <span>Department</span>

                    <strong>
                        ${safe(
                            complaint.department
                        )}
                    </strong>

                </div>


                <div class="tracking-detail">

                    <span>Location</span>

                    <strong>
                        ${safe(
                            buildLocationText(
                                complaint
                            )
                        )}
                    </strong>

                </div>


                <div class="tracking-detail">

                    <span>Submitted Date</span>

                    <strong>
                        ${safe(
                            complaint.date
                        )}
                    </strong>

                </div>

            </div>


            ${
                complaint.adminRemark
                    ? `
                        <div class="tracking-description">

                            <strong>
                                Admin Update
                            </strong>

                            <br><br>

                            ${safe(
                                complaint.adminRemark
                            )}

                        </div>
                    `
                    : ""
            }


            ${
                complaint.status === "Resolved"
                    ? createFeedbackSection(
                        complaint
                    )
                    : ""
            }

        </div>

    `;


    setupFeedback(
        complaint.complaintId,
        rollNumber
    );

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
// FEEDBACK SECTION
// ==========================================

function createFeedbackSection(
    complaint
) {

    if (
        Number(
            complaint.feedbackRating || 0
        ) > 0
    ) {

        return `

            <div class="feedback-box">

                <strong>
                    Your Feedback
                </strong>

                <p>
                    Rating:
                    ${"★".repeat(
                        Number(
                            complaint.feedbackRating
                        )
                    )}
                </p>

                <p>
                    ${
                        complaint.feedbackComment
                            ? safe(
                                complaint.feedbackComment
                              )
                            : "No written comment."
                    }
                </p>

            </div>

        `;

    }


    return `

        <div class="feedback-box">

            <strong>
                Complaint Resolved
            </strong>

            <p>
                Please share your feedback.
            </p>


            <div
                class="feedback-stars"
                id="feedbackStars"
            >

                ${[1,2,3,4,5].map(
                    function (number) {

                        return `

                            <button
                                type="button"
                                class="feedback-star"
                                data-rating="${number}"
                            >
                                ★
                            </button>

                        `;

                    }
                ).join("")}

            </div>


            <textarea
                id="feedbackComment"
                rows="3"
                placeholder="Write your feedback (optional)"
            ></textarea>


            <button
                type="button"
                class="feedback-submit"
                id="feedbackSubmit"
            >
                Submit Feedback
            </button>

        </div>

    `;

}


// ==========================================
// FEEDBACK
// ==========================================

function setupFeedback(
    complaintId,
    rollNumber
) {

    const stars =
        document.querySelectorAll(
            ".feedback-star"
        );


    let selectedRating = 0;


    stars.forEach(
        function (star) {

            star.addEventListener(
                "click",
                function () {

                    selectedRating =
                        Number(
                            this.dataset.rating
                        );


                    stars.forEach(
                        function (item) {

                            item.classList.toggle(
                                "selected",
                                Number(
                                    item.dataset.rating
                                ) <=
                                selectedRating
                            );

                        }
                    );

                }
            );

        }
    );


    const button =
        document.getElementById(
            "feedbackSubmit"
        );


    if (button) {

        button.addEventListener(
            "click",
            async function () {

                if (
                    selectedRating < 1
                ) {

                    alert(
                        "Please select a rating."
                    );

                    return;

                }


                const comment =
                    document.getElementById(
                        "feedbackComment"
                    ).value.trim();


                let complaint;
                try {
                    complaint = await requestApi(
                        `/api/complaints/${encodeURIComponent(complaintId)}/feedback`,
                        {
                            method: "PATCH",
                            body: JSON.stringify({
                                rating: selectedRating,
                                comment,
                                rollNumber
                            })
                        }
                    );
                } catch (error) {
                    console.error(error);
                    alert(`Feedback could not be submitted: ${error.message}`);
                    return;
                }


                alert(
                    "Thank you for your feedback."
                );


                renderTrackingResult(
                    complaint,
                    rollNumber
                );

            }
        );

    }

}


// ==========================================
// RECEIPT
// ==========================================

function showComplaintReceipt(
    complaint
) {

    const old =
        document.getElementById(
            "receiptOverlay"
        );


    if (old) {
        old.remove();
    }


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "receiptOverlay";

    overlay.className =
        "receipt-overlay";


    overlay.innerHTML = `

        <div class="receipt-modal">

            <div class="receipt-title">

                <h2>
                    Complaint Submitted Successfully
                </h2>

                <p>
                    Smart Campus Complaint Receipt
                </p>

            </div>


            <div class="receipt-grid">


                <div class="receipt-item">

                    <span class="receipt-label">
                        Complaint ID
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.complaintId
                        )}
                    </div>

                </div>


                <div class="receipt-item">

                    <span class="receipt-label">
                        Student Name
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.studentName
                        )}
                    </div>

                </div>


                <div class="receipt-item">

                    <span class="receipt-label">
                        Roll Number
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.rollNumber
                        )}
                    </div>

                </div>


                <div class="receipt-item">

                    <span class="receipt-label">
                        Category
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.category
                        )}
                    </div>

                </div>


                <div class="receipt-item">

                    <span class="receipt-label">
                        Priority
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.priority
                        )}
                    </div>

                </div>


                <div class="receipt-item">

                    <span class="receipt-label">
                        Department
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.department
                        )}
                    </div>

                </div>


                <div class="receipt-item">

                    <span class="receipt-label">
                        Building / Section
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.building
                        )}
                    </div>

                </div>


                <div class="receipt-item">

                    <span class="receipt-label">
                        Floor
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.floor
                        )}
                    </div>

                </div>


                <div class="receipt-item">

                    <span class="receipt-label">
                        Room / Lab
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.roomNumber ||
                            "Not provided"
                        )}
                    </div>

                </div>


                <div class="receipt-item">

                    <span class="receipt-label">
                        Submitted Date & Time
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.date
                        )}
                    </div>

                </div>


                <div class="receipt-item">

                    <span class="receipt-label">
                        Current Status
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.status
                        )}
                    </div>

                </div>


                <div class="receipt-item">

                    <span class="receipt-label">
                        Tracking ID
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.complaintId
                        )}
                    </div>

                </div>


                <div class="receipt-item full">

                    <span class="receipt-label">
                        Description
                    </span>

                    <div class="receipt-value">
                        ${safe(
                            complaint.description
                        )}
                    </div>

                </div>

            </div>


            ${
                complaint.photoData
                    ? `
                        <div class="receipt-photo">

                            <p>
                                <strong>
                                    Evidence Photo
                                </strong>
                            </p>

                            <br>

                            <img
                                src="${safe(
                                    complaint.photoData
                                )}"
                                alt="Evidence"
                            >

                        </div>
                    `
                    : `
                        <p style="margin-top:15px;color:#64748b;">
                            Evidence Photo: No photo uploaded
                        </p>
                    `
            }


            <div class="receipt-actions">

                <button
                    type="button"
                    class="print-button"
                    id="printReceiptButton"
                >
                    Print Receipt
                </button>


                <button
                    type="button"
                    class="close-button"
                    id="closeReceiptButton"
                >
                    Close
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        overlay
    );


    document.getElementById(
        "closeReceiptButton"
    ).addEventListener(
        "click",
        function () {

            overlay.remove();

        }
    );


    document.getElementById(
        "printReceiptButton"
    ).addEventListener(
        "click",
        function () {

            printComplaintReceipt(
                complaint
            );

        }
    );

}


// ==========================================
// PRINT RECEIPT
// ==========================================

function printComplaintReceipt(
    complaint
) {

    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {

        alert(
            "Please allow pop-ups to print the receipt."
        );

        return;

    }


    printWindow.document.write(`

        <!DOCTYPE html>

        <html>

        <head>

            <title>
                ${safe(
                    complaint.complaintId
                )} - Complaint Receipt
            </title>

            <style>

                body {
                    font-family: Arial, sans-serif;
                    padding: 30px;
                    color: #1f2937;
                }

                h1 {
                    text-align: center;
                    color: #0f4c81;
                }

                p.subtitle {
                    text-align: center;
                    color: #64748b;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 25px;
                }

                td {
                    padding: 10px;
                    border: 1px solid #dbe3ea;
                    vertical-align: top;
                }

                td:first-child {
                    width: 30%;
                    font-weight: bold;
                    background: #f1f5f9;
                }

                .description {
                    white-space: pre-wrap;
                }

                img {
                    max-width: 500px;
                    max-height: 350px;
                    display: block;
                    margin: 15px auto;
                }

                .note {
                    margin-top: 25px;
                    text-align: center;
                    color: #64748b;
                    font-size: 13px;
                }

            </style>

        </head>


        <body>

            <h1>
                Smart Campus
            </h1>

            <p class="subtitle">
                Complaint & Resolution System
            </p>


            <table>

                <tr>
                    <td>Complaint ID</td>
                    <td>
                        ${safe(
                            complaint.complaintId
                        )}
                    </td>
                </tr>

                <tr>
                    <td>Student Name</td>
                    <td>
                        ${safe(
                            complaint.studentName
                        )}
                    </td>
                </tr>

                <tr>
                    <td>Roll Number</td>
                    <td>
                        ${safe(
                            complaint.rollNumber
                        )}
                    </td>
                </tr>

                <tr>
                    <td>Category</td>
                    <td>
                        ${safe(
                            complaint.category
                        )}
                    </td>
                </tr>

                <tr>
                    <td>Priority</td>
                    <td>
                        ${safe(
                            complaint.priority
                        )}
                    </td>
                </tr>

                <tr>
                    <td>Department</td>
                    <td>
                        ${safe(
                            complaint.department
                        )}
                    </td>
                </tr>

                <tr>
                    <td>Building / Section</td>
                    <td>
                        ${safe(
                            complaint.building
                        )}
                    </td>
                </tr>

                <tr>
                    <td>Floor</td>
                    <td>
                        ${safe(
                            complaint.floor
                        )}
                    </td>
                </tr>

                <tr>
                    <td>Room / Lab</td>
                    <td>
                        ${safe(
                            complaint.roomNumber ||
                            "Not provided"
                        )}
                    </td>
                </tr>

                <tr>
                    <td>Submitted Date & Time</td>
                    <td>
                        ${safe(
                            complaint.date
                        )}
                    </td>
                </tr>

                <tr>
                    <td>Status</td>
                    <td>
                        ${safe(
                            complaint.status
                        )}
                    </td>
                </tr>

                <tr>
                    <td>Location</td>
                    <td>
                        ${safe(
                            buildLocationText(
                                complaint
                            )
                        )}
                    </td>
                </tr>

                <tr>
                    <td>Description</td>
                    <td class="description">
                        ${safe(
                            complaint.description
                        )}
                    </td>
                </tr>

            </table>


            ${
                complaint.photoData
                    ? `
                        <p style="margin-top:20px;">
                            <strong>
                                Evidence Photo
                            </strong>
                        </p>

                        <img
                            src="${safe(
                                complaint.photoData
                            )}"
                            alt="Evidence"
                        >
                    `
                    : `
                        <p>
                            Evidence Photo: No photo uploaded
                        </p>
                    `
            }


            <p class="note">
                Please keep your Complaint ID for future tracking.
            </p>


            <script>

                window.onload = function () {
                    window.print();
                };

            <\/script>

        </body>

        </html>

    `);


    printWindow.document.close();

}


// ==========================================
// SAFE TEXT
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