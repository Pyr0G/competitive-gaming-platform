(() => {
    const containers = ["modal", "chat", "admin"].map((id) => document.getElementById(id));
    const focusable = (dialog) => [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])')].filter((element) => element.getClientRects().length && !element.closest("[hidden], [inert]"));
    let active = null;
    let returnFocus = null;
    const sync = () => {
        const container = containers.findLast((element) => !element.hidden);
        const next = container?.querySelector('[role="dialog"]') || null;
        if (next === active) return;
        const before = active;
        active = next;
        [...document.body.children].forEach((element) => {
            if (!["SCRIPT", "STYLE"].includes(element.tagName)) element.inert = Boolean(active && !element.contains(active) && element.id !== "toasts" && element.id !== "locale-status");
        });
        if (active) {
            if (!before) returnFocus = document.activeElement;
            active.tabIndex = -1;
            (focusable(active)[0] || active).focus();
        } else if (before) {
            if (returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus();
            else document.querySelector(".btn-login")?.focus();
            returnFocus = null;
        }
    };
    new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("keydown", (event) => {
        if (!active) {
            if (event.key === "Escape") {
                const settings = document.querySelector(".locale-settings[open]");
                if (settings) {
                    settings.open = false;
                    settings.querySelector("summary").focus();
                }
            }
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopImmediatePropagation();
            active.querySelector(".modal-close, .chat-x, #admin-close")?.click();
        }
        if (event.key !== "Tab") return;
        const elements = focusable(active);
        const first = elements[0] || active;
        const last = elements.at(-1) || active;
        if (event.shiftKey && (document.activeElement === first || !active.contains(document.activeElement))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !active.contains(document.activeElement))) {
            event.preventDefault();
            first.focus();
        }
    }, true);
    document.addEventListener("focusin", (event) => {
        if (active && !active.contains(event.target)) (focusable(active)[0] || active).focus();
    });
    document.querySelector(".tutorial")?.addEventListener("focusin", () => document.getElementById("steps").classList.add("paused"));
    sync();
})();
