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

const isChatView = (view, id) => view === chatView && chatId === id && !chatBox.hidden && currentUser;

const clock = (value) => {
    const d = new Date(value);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const setBadge = (n) => {
    chatBadge.hidden = !n;
    chatBadge.textContent = n > 9 ? "9+" : String(n);
};

const refreshUnread = async () => {
    const userId = currentUser?.id;
    const request = ++unreadRequest;
    if (!userId || !(await backend) || currentUser?.id !== userId) return;
    const data = await api("/chat/unread").catch(() => null);
    if (data && currentUser?.id === userId && request === unreadRequest) setBadge(data.unread);
};

const bubble = (m) => `<div class="msg ${m.mine ? "mine" : "theirs"}" data-id="${m.id}">
    <p>${esc(m.content)}</p>
    <time>${clock(m.sent_at)}</time>
</div>`;

const refreshList = async () => {
    const view = chatView;
    const request = ++listRequest;
    if (!(await backend)) {
        if (isChatView(view, null)) chatList.innerHTML = `<p class="chat-empty">Czat działa na stronie online. Zaloguj się tam i napisz do kogoś z ogłoszenia.</p>`;
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
                <em>${esc(c.content || "Napisz pierwszą wiadomość")}</em>
            </span>
            ${c.unread ? `<i>${c.unread}</i>` : ""}
        </button>`).join("")
        : `<p class="chat-empty">Tu pojawią się rozmowy. Wejdź w ogłoszenie i kliknij Napisz.</p>`;
};

const showList = async () => {
    chatView++;
    chatId = null;
    lastMsg = 0;
    chatThread.hidden = true;
    chatList.hidden = false;
    chatBack.hidden = true;
    chatMenu.hidden = true;
    chatPop.hidden = true;
    chatMore.setAttribute("aria-expanded", "false");
    chatName.textContent = "Wiadomości";
    chatStatus.textContent = "";
    await refreshList();
};

const paintThread = (data, append) => {
    const c = data.conversation;
    chatName.textContent = c.nick;
    chatStatus.textContent = c.blocked ? "Zablokowany" : c.blocked_by ? "Nie przyjmuje wiadomości" : "Rozmowa";
    chatBlocked.hidden = !c.blocked;
    chatForm.hidden = Boolean(c.blocked || c.blocked_by || !chatReport.hidden);
    chatTyping.hidden = !c.typing || c.blocked;
    $("span", chatTyping).textContent = `${c.nick} pisze`;
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
    lastMsg = 0;
    chatList.hidden = true;
    chatThread.hidden = false;
    chatBack.hidden = false;
    chatMenu.hidden = false;
    chatReport.hidden = true;
    chatForm.hidden = true;
    chatBlocked.hidden = true;
    chatTyping.hidden = true;
    chatName.textContent = "Wczytywanie...";
    chatStatus.textContent = "";
    chatInput.value = "";
    chatInput.style.height = "";
    chatMsgs.innerHTML = "";
    await refreshThread().catch((err) => {
        if (isChatView(view, id)) toast(err.message, "err");
    });
    if (isChatView(view, id)) refreshUnread();
};

const openChat = async (userId) => {
    if (!currentUser) return openModal("login", "Zaloguj się, żeby napisać do gracza.");
    const view = ++chatView;
    if (!(await backend)) return toast("Czat działa na stronie online.", "err");
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
            toast(err.message, "err");
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
        if (!currentUser) return openModal("login", "Zaloguj się, żeby zobaczyć wiadomości.");
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
        toast(err.message, "err");
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
    if (chatId) api(`/chat/${chatId}/typing`, {}).catch(() => {});
});

$$("[data-chat-act]").forEach((btn) => btn.addEventListener("click", async () => {
    if (!chatId) return;
    const act = btn.dataset.chatAct;
    try {
        if (act === "block") {
            await api(`/chat/${chatId}/block`, {});
            toast("Gracz zablokowany. Nie napisze już do Ciebie.");
            openThread(chatId);
        } else if (act === "unblock") {
            await api(`/chat/${chatId}/block`, undefined, "DELETE");
            toast("Gracz odblokowany.");
            openThread(chatId);
        } else if (act === "report") {
            chatReport.hidden = false;
            chatForm.hidden = true;
            chatPop.hidden = true;
        }
    } catch (err) {
        toast(err.message, "err");
    }
}));

chatReport.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reason = chatReport.reason.value.trim();
    if (reason.length < 8) return toast("Dopisz, co się stało. Minimum 8 znaków.", "err");
    try {
        await api(`/chat/${chatId}/report`, { reason });
        chatReport.reset();
        chatReport.hidden = true;
        chatForm.hidden = false;
        toast("Zgłoszenie poszło do admina.");
    } catch (err) {
        toast(err.message, "err");
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
        setBadge(0);
    }
    if (currentUser) refreshUnread();
});

chatTick = setInterval(pollChat, 2500);
refreshUnread();
