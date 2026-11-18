const chatBox = $("#chat");
const chatList = $("#chat-list");
const chatThread = $("#chat-thread");
const chatMsgs = $("#chat-msgs");
const chatForm = $("#chat-form");
const chatInput = $("textarea", chatForm);
const chatName = $("#chat-name");
const chatStatus = $("#chat-status");
const chatBack = $("#chat-back");
const chatMenu = $("#chat-menu");
const chatPop = $("#chat-pop");
const chatMore = $("#chat-more");
const chatTyping = $("#chat-typing");
const chatReport = $("#chat-report");
const chatBlocked = $("#chat-blocked");
const chatBadge = $("#chat-badge");

let chatId = null;
let lastMsg = 0;
let chatTick = null;
let chatBusy = false;
let chatView = 0;
let chatUserId = currentUser?.id;
let unreadRequest = 0;
let listRequest = 0;
let typingSentAt = -Infinity;

const isChatView = (view, id) => view === chatView && chatId === id && !chatBox.hidden && currentUser;
const clock = (value) => I18N.formatDate(value, { hour: "2-digit", minute: "2-digit" });
let chatUnread = 0;


const setBadge = (n) => {
    chatUnread = n;
    chatBadge.hidden = !n;
    chatBadge.textContent = n > 9 ? `${I18N.formatNumber(9)}+` : I18N.formatNumber(n);
    $("#chat-btn").setAttribute("aria-label", tx(n ? "chat.unread" : "chat.title", { count: n }));
};

const refreshUnread = async () => {
    const userId = currentUser?.id;
    const request = ++unreadRequest;
    if (!userId || !(await backend) || currentUser?.id !== userId) return;
    const data = await api("/chat/unread").catch(() => null);
    if (data && currentUser?.id === userId && request === unreadRequest) setBadge(data.unread);
};

const bubble = (m) => `<div class="msg ${m.mine ? "mine" : "theirs"}" data-id="${m.id}">
    <p dir="auto">${esc(m.content)}</p>
    <time datetime="${esc(m.sent_at)}" data-i18n-date="time">${clock(m.sent_at)}</time>
</div>`;

const refreshList = async () => {
    const view = chatView;
    const request = ++listRequest;
    if (!(await backend)) {
        if (isChatView(view, null)) chatList.innerHTML = `<p class="chat-empty">${tr("chat.demo")}</p>`;
        return;
    }
    if (!isChatView(view, null)) return;
    const data = await api("/chat").catch(() => null);
    if (!data || !isChatView(view, null) || request !== listRequest) return;
    const { conversations } = data;
    setBadge(conversations.reduce((sum, c) => sum + c.unread, 0));
    chatList.innerHTML = conversations.length
        ? conversations.map((c) => `<button type="button" class="chat-item ${c.unread ? "fresh" : ""}" data-open-chat="${c.id}">
            <span class="avatar avatar-player">${esc(c.nick[0])}</span>
            <span>
                <b>${esc(c.nick)}</b>
                <em dir="auto">${c.content ? esc(c.content) : tr("chat.firstMessage")}</em>
            </span>
            ${c.unread ? `<i>${c.unread}</i>` : ""}
        </button>`).join("")
        : `<p class="chat-empty">${tr("chat.empty")}</p>`;
};

const showList = async () => {
    chatView++;
    chatId = null;
    lastMsg = 0;
    chatThread.hidden = true;
    chatList.innerHTML = `<p class="chat-empty">${tr("chat.loading")}</p>`;
    chatList.hidden = false;
    chatBack.hidden = true;
    chatMenu.hidden = true;
    chatPop.hidden = true;
    chatMore.setAttribute("aria-expanded", "false");
    I18N.bind(chatName, "chat.title");
    delete chatStatus.dataset.i18n;
    chatStatus.textContent = "";
    await refreshList();
};

const paintThread = (data, append) => {
    const c = data.conversation;
    delete chatName.dataset.i18n;
    chatName.textContent = c.nick;
    I18N.bind(chatStatus, c.blocked ? "chat.blocked" : c.blocked_by ? "chat.unavailable" : "chat.conversation");
    chatBlocked.hidden = !c.blocked;
    chatForm.hidden = Boolean(c.blocked || c.blocked_by || !chatReport.hidden);
    chatTyping.hidden = !c.typing || c.blocked;
    I18N.bind($("span", chatTyping), "chat.typing", { nick: c.nick });
    $("[data-chat-act=block]", chatPop).hidden = c.blocked;
    if (!append) chatMsgs.innerHTML = "";
    const atBottom = chatMsgs.scrollHeight - chatMsgs.scrollTop - chatMsgs.clientHeight < 80;
    data.messages.forEach((m) => {
        if (chatMsgs.querySelector(`[data-id="${m.id}"]`)) return;
        chatMsgs.insertAdjacentHTML("beforeend", bubble(m));
        lastMsg = Math.max(lastMsg, m.id);
    });
    if (!append || atBottom) chatMsgs.scrollTop = chatMsgs.scrollHeight;
};

const refreshThread = async () => {
    const id = chatId;
    const view = chatView;
    if (!id || !isChatView(view, id)) return;
    const data = await api(`/chat/${id}?after=${lastMsg}`);
    if (isChatView(view, id)) paintThread(data, true);
};

const openThread = async (id) => {
    const view = ++chatView;
    chatId = id;
    typingSentAt = -Infinity;
    lastMsg = 0;
    chatList.hidden = true;
    chatThread.hidden = false;
    chatBack.hidden = false;
    chatMenu.hidden = false;
    chatReport.hidden = true;
    chatForm.hidden = true;
    chatBlocked.hidden = true;
    chatTyping.hidden = true;
    I18N.bind(chatName, "common.loading");
    delete chatStatus.dataset.i18n;
    chatStatus.textContent = "";
    chatInput.value = "";
    chatInput.style.height = "";
    chatMsgs.innerHTML = "";
    await refreshThread().catch((err) => {
        if (isChatView(view, id)) toastError(err);
    });
    if (isChatView(view, id)) refreshUnread();
};

const openChat = async (userId) => {
    if (!currentUser) return openModal("login", "chat.signIn");
    const view = ++chatView;
    if (!(await backend)) return toast("chat.offline", "err");
    if (view !== chatView || !currentUser) return;
    chatBox.hidden = false;
    document.body.classList.add("chat-on");
    if (userId) {
        try {
            const data = await api("/chat/open", { userId: Number(userId) });
            if (view !== chatView || !currentUser) return;
            await openThread(data.id);
        } catch (err) {
            if (view !== chatView || !currentUser) return;
            toastError(err);
            await showList();
        }
    } else {
        await showList();
    }
};

const closeChat = () => {
    chatView++;
    chatBox.hidden = true;
    document.body.classList.remove("chat-on");
    chatId = null;
    chatPop.hidden = true;
};

const pollChat = async () => {
    if (chatBusy || !currentUser) return;
    chatBusy = true;
    try {
        if (!(await backend) || !currentUser) return;
        if (chatBox.hidden) {
            await refreshUnread();
        } else if (chatId) {
            await refreshThread();
            await refreshUnread();
        } else {
            await refreshList();
        }
    } catch {
        if (!currentUser) closeChat();
    } finally {
        chatBusy = false;
    }
};

document.addEventListener("click", (e) => {
    if (e.target.closest("[data-chat-open]")) {
        if (!currentUser) return openModal("login", "chat.signInInbox");
        openChat();
    }
    const start = e.target.closest("[data-chat]");
    if (start) openChat(start.dataset.chat);
    if (e.target.closest("[data-chat-close]")) closeChat();
    const item = e.target.closest("[data-open-chat]");
    if (item) openThread(Number(item.dataset.openChat));
    if (e.target.closest("#chat-back")) showList();
    if (e.target.closest("#chat-more")) {
        const open = chatPop.hidden;
        chatPop.hidden = !open;
        chatMore.setAttribute("aria-expanded", open);
    } else if (!e.target.closest("#chat-pop")) {
        chatPop.hidden = true;
        chatMore.setAttribute("aria-expanded", "false");
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !chatBox.hidden) closeChat();
});

$("#chat-btn").addEventListener("click", () => (chatBox.hidden ? openChat() : closeChat()));

chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = chatInput.value.trim();
    if (!content || !chatId) return;
    const id = chatId;
    const view = chatView;
    chatInput.value = "";
    chatInput.style.height = "";
    try {
        await api(`/chat/${id}`, { content });
    } catch (err) {
        if (!isChatView(view, id)) return;
        if (!chatInput.value) chatInput.value = content;
        toastError(err);
        return;
    }
    if (isChatView(view, id)) await refreshThread().catch(() => {});
});

chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        chatForm.requestSubmit();
    }
});

chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
    const time = Date.now();
    if (chatId && currentUser && time - typingSentAt >= 1000) {
        typingSentAt = time;
        api(`/chat/${chatId}/typing`, {}).catch(() => {});
    }
});

$$("[data-chat-act]").forEach((btn) => btn.addEventListener("click", async () => {
    if (!chatId) return;
    const id = chatId;
    const view = chatView;
    const act = btn.dataset.chatAct;
    try {
        if (act === "block") {
            await api(`/chat/${id}/block`, {});
            if (!isChatView(view, id)) return;
            toast("chat.userBlocked");
            openThread(id);
        } else if (act === "unblock") {
            await api(`/chat/${id}/block`, undefined, "DELETE");
            if (!isChatView(view, id)) return;
            toast("chat.userUnblocked");
            openThread(id);
        } else if (act === "report") {
            chatReport.hidden = false;
            chatForm.hidden = true;
            chatPop.hidden = true;
        }
    } catch (err) {
        if (isChatView(view, id)) toastError(err);
    }
}));

chatReport.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = chatId;
    const view = chatView;
    if (!id) return;
    const reason = chatReport.reason.value.trim();
    if (reason.length < 8) return toast("chat.reasonShort", "err");
    try {
        await api(`/chat/${id}/report`, { reason });
        if (!isChatView(view, id)) return;
        chatReport.reset();
        chatReport.hidden = true;
        chatForm.hidden = false;
        toast("chat.reportSent");
    } catch (err) {
        if (isChatView(view, id)) toastError(err);
    }
});

$("#chat-report-cancel").addEventListener("click", () => {
    chatReport.hidden = true;
    chatForm.hidden = false;
});

document.addEventListener("cgp:user", () => {
    if (chatUserId !== currentUser?.id || !currentUser) {
        chatUserId = currentUser?.id;
        closeChat();
        unreadRequest++;
        listRequest++;
        lastMsg = 0;
        chatList.innerHTML = "";
        chatMsgs.innerHTML = "";
        chatInput.value = "";
        chatInput.style.height = "";
        chatReport.reset();
        chatReport.hidden = true;
        chatName.textContent = "";
        chatStatus.textContent = "";
        delete chatName.dataset.i18n;
        delete chatStatus.dataset.i18n;
        chatTyping.hidden = true;
        $("span", chatTyping).textContent = "";
        chatForm.hidden = true;
        chatBlocked.hidden = true;
        chatMenu.hidden = true;
        chatMore.setAttribute("aria-expanded", "false");
        setBadge(0);
    }
    if (currentUser) refreshUnread();
});

chatTick = setInterval(pollChat, 2500);
refreshUnread();
document.addEventListener("cgp:languagechange", () => setBadge(chatUnread));
