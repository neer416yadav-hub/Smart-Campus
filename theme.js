// ==========================================
// SMART CAMPUS - SHARED UI TOOLKIT
// Dark mode, toasts, animations and helpers
// used by both the student page and the admin
// dashboard. Loaded before the page scripts.
// ==========================================

(function () {
    "use strict";

    const THEME_KEY = "sc-theme";
    const REDUCED_MOTION =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ==========================================
    // THEME
    // ==========================================

    function getStoredTheme() {
        try {
            return localStorage.getItem(THEME_KEY);
        } catch (error) {
            return null;
        }
    }

    function storeTheme(theme) {
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch (error) {
            /* storage is unavailable, theme stays for this page only */
        }
    }

    function prefersDark() {
        return (
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
        );
    }

    function resolveTheme() {
        const stored = getStoredTheme();
        if (stored === "light" || stored === "dark") {
            return stored;
        }
        return prefersDark() ? "dark" : "light";
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        document.documentElement.style.colorScheme = theme;

        document.querySelectorAll("[data-theme-toggle]").forEach(
            function (button) {
                const icon = button.querySelector("[data-theme-icon]");
                const label = button.querySelector("[data-theme-label]");

                if (icon) {
                    icon.textContent = theme === "dark" ? "☀" : "☾";
                }
                if (label) {
                    label.textContent =
                        theme === "dark" ? "Light Mode" : "Dark Mode";
                }
                button.setAttribute(
                    "aria-label",
                    theme === "dark"
                        ? "Switch to light mode"
                        : "Switch to dark mode"
                );
            }
        );
    }

    function setupThemeToggle() {
        if (setupThemeToggle.done) {
            return;
        }
        setupThemeToggle.done = true;

        applyTheme(resolveTheme());

        document.querySelectorAll("[data-theme-toggle]").forEach(
            function (button) {
                button.addEventListener("click", function () {
                    const next =
                        document.documentElement.getAttribute("data-theme") ===
                        "dark"
                            ? "light"
                            : "dark";
                    applyTheme(next);
                    storeTheme(next);
                });
            }
        );

        if (window.matchMedia) {
            const media = window.matchMedia("(prefers-color-scheme: dark)");
            const onChange = function () {
                if (!getStoredTheme()) {
                    applyTheme(resolveTheme());
                }
            };
            if (media.addEventListener) {
                media.addEventListener("change", onChange);
            } else if (media.addListener) {
                media.addListener(onChange);
            }
        }
    }

    // ==========================================
    // TOASTS
    // ==========================================

    function toastHost() {
        let host = document.getElementById("scToastHost");

        if (!host) {
            host = document.createElement("div");
            host.id = "scToastHost";
            host.className = "sc-toast-host";
            host.setAttribute("role", "status");
            host.setAttribute("aria-live", "polite");
            document.body.appendChild(host);
        }

        return host;
    }

    function scToast(message, type, duration) {
        const host = toastHost();
        const kind = type || "info";
        const toast = document.createElement("div");
        const icons = {
            success: "✓",
            error: "!",
            warning: "!",
            info: "i"
        };

        toast.className = `sc-toast sc-toast-${kind}`;
        toast.innerHTML = `
            <span class="sc-toast-icon">${icons[kind] || icons.info}</span>
            <span class="sc-toast-message"></span>
            <button type="button" class="sc-toast-close" aria-label="Dismiss notification">×</button>
        `;
        toast.querySelector(".sc-toast-message").textContent = message;

        function dismiss() {
            toast.classList.add("sc-toast-hide");
            window.setTimeout(function () {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 260);
        }

        toast.querySelector(".sc-toast-close").addEventListener(
            "click",
            dismiss
        );

        host.appendChild(toast);

        window.requestAnimationFrame(function () {
            toast.classList.add("sc-toast-show");
        });

        window.setTimeout(dismiss, duration || 4200);

        return toast;
    }

    // ==========================================
    // SCROLL REVEAL
    // ==========================================

    function setupReveal() {
        if (setupReveal.done) {
            return;
        }
        setupReveal.done = true;

        const items = document.querySelectorAll("[data-reveal]");

        if (!items.length) {
            return;
        }

        if (REDUCED_MOTION || !("IntersectionObserver" in window)) {
            items.forEach(function (item) {
                item.classList.add("is-revealed");
            });
            return;
        }

        const observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-revealed");
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
        );

        items.forEach(function (item, index) {
            const delay = item.getAttribute("data-reveal-delay");
            if (delay) {
                item.style.setProperty("--reveal-delay", delay + "ms");
            }
            if (!item.style.getPropertyValue("--reveal-order")) {
                item.style.setProperty("--reveal-order", String(index));
            }
            observer.observe(item);
        });
    }

    // ==========================================
    // ANIMATED COUNTERS
    // ==========================================

    function animateNumber(element, to, options) {
        const config = options || {};
        const duration = config.duration || 1400;
        const decimals = config.decimals || 0;
        const suffix = config.suffix || "";
        const prefix = config.prefix || "";

        const from = Number(config.from || 0);
        const target = Number(to || 0);

        function render(value) {
            element.textContent =
                prefix +
                value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
                suffix;
        }

        if (REDUCED_MOTION) {
            render(target);
            return;
        }

        const startTime = performance.now();

        function step(now) {
            const progress = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            render(from + (target - from) * eased);

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                render(target);
            }
        }

        window.requestAnimationFrame(step);
    }

    function setupCounters() {
        if (setupCounters.done) {
            return;
        }
        setupCounters.done = true;

        const counters = document.querySelectorAll("[data-count-to]");

        if (!counters.length) {
            return;
        }

        if (REDUCED_MOTION || !("IntersectionObserver" in window)) {
            counters.forEach(function (element) {
                animateNumber(element, element.getAttribute("data-count-to"), {
                    decimals: Number(element.getAttribute("data-count-decimals") || 0),
                    suffix: element.getAttribute("data-count-suffix") || ""
                });
            });
            return;
        }

        const observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) {
                        return;
                    }
                    const element = entry.target;
                    observer.unobserve(element);
                    animateNumber(element, element.getAttribute("data-count-to"), {
                        decimals: Number(
                            element.getAttribute("data-count-decimals") || 0
                        ),
                        suffix: element.getAttribute("data-count-suffix") || ""
                    });
                });
            },
            { threshold: 0.4 }
        );

        counters.forEach(function (element) {
            observer.observe(element);
        });
    }

    // ==========================================
    // RIPPLE
    // ==========================================

    function setupRipple() {
        document.addEventListener("click", function (event) {
            const target = event.target.closest(
                ".primary-button, .secondary-button, .ghost-button, .ai-suggest-button, .ai-apply-button, .logout-button, .refresh-button, .login-button, .toolbar-button, .view-details-button, .sc-save-remark-button, .sc-modal-close-button"
            );

            if (!target || REDUCED_MOTION) {
                return;
            }

            const rect = target.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const ripple = document.createElement("span");

            ripple.className = "sc-ripple";
            ripple.style.width = size + "px";
            ripple.style.height = size + "px";
            ripple.style.left =
                event.clientX - rect.left - size / 2 + "px";
            ripple.style.top = event.clientY - rect.top - size / 2 + "px";

            target.appendChild(ripple);

            window.setTimeout(function () {
                ripple.remove();
            }, 620);
        });
    }

    // ==========================================
    // HEADER SHADOW ON SCROLL
    // ==========================================

    function setupScrollState() {
        const header = document.querySelector("[data-scroll-header]");

        if (!header) {
            return;
        }

        function onScroll() {
            if (window.scrollY > 12) {
                header.classList.add("is-scrolled");
            } else {
                header.classList.remove("is-scrolled");
            }
        }

        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
    }

    // ==========================================
    // COPY TO CLIPBOARD
    // ==========================================

    async function scCopy(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (error) {
            /* fall through to the legacy approach */
        }

        try {
            const area = document.createElement("textarea");
            area.value = text;
            area.setAttribute("readonly", "");
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();
            const copied = document.execCommand("copy");
            area.remove();
            return copied;
        } catch (error) {
            return false;
        }
    }

    // ==========================================
    // FORMATTING HELPERS
    // ==========================================

    function formatDateTime(value) {
        if (!value) {
            return "—";
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "—";
        }
        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function timeAgo(value) {
        if (!value) {
            return "";
        }
        const stamp = Number(value);
        if (!Number.isFinite(stamp)) {
            return "";
        }
        const seconds = Math.floor((Date.now() - stamp) / 1000);
        if (seconds < 60) {
            return "just now";
        }
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return minutes + " min ago";
        }
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return hours + " hr ago";
        }
        const days = Math.floor(hours / 24);
        if (days < 30) {
            return days + " day" + (days > 1 ? "s" : "") + " ago";
        }
        const months = Math.floor(days / 30);
        return months + " month" + (months > 1 ? "s" : "") + " ago";
    }

    // ==========================================
    // EXPORT
    // ==========================================

    window.SmartCampusUI = {
        toast: scToast,
        animateNumber: animateNumber,
        copy: scCopy,
        formatDateTime: formatDateTime,
        timeAgo: timeAgo,
        reducedMotion: REDUCED_MOTION,
        init: function () {
            setupThemeToggle();
            setupReveal();
            setupCounters();
            setupRipple();
            setupScrollState();
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupThemeToggle);
    } else {
        setupThemeToggle();
    }
})();
