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

const clock = (value) => {
    const d = new Date(value);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const setBadge = (n) => {
    chatBadge.hidden = !n;
    chatBadge.textContent = n > 9 ? "9+" : String(n);
};

const refreshUnread = async () => {
    if (!currentUser || !(await backend)) return;
    const data = await api("/chat/unread").catch(() => null);
    if (data) setBadge(data.unread);
};

const bubble = (m) => `<div class="msg ${m.mine ? "mine" : "theirs"}" data-id="${m.id}">
    <p>${esc(m.content)}</p>
    <time>${clock(m.sent_at)}</time>
</div>`;

const showList = async () => {
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
    if (!(await backend)) {
        chatList.innerHTML = `<p class="chat-empty">Czat działa na stronie online. Zaloguj się tam i napisz do kogoś z ogłoszenia.</p>`;
        return;
    }
    const { conversations } = await api("/chat").catch(() => ({ conversations: [] }));
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

const openThread = async (id) => {
    chatId = id;
    lastMsg = 0;
    chatList.hidden = true;
    chatThread.hidden = false;
    chatBack.hidden = false;
    chatMenu.hidden = false;
    chatReport.hidden = true;
    chatMsgs.innerHTML = "";
    const data = await api(`/chat/${id}`).catch((err) => {
        toast(err.message, "err");
        return null;
    });
    if (!data || chatId !== id) return;
    paintThread(data, false);
    refreshUnread();
};

const openChat = async (userId) => {
    if (!currentUser) return openModal("login", "Zaloguj się, żeby napisać do gracza.");
    if (!(await backend)) return toast("Czat działa na stronie online.", "err");
    chatBox.hidden = false;
    document.body.classList.add("chat-on");
    if (userId) {
        try {
            const data = await api("/chat/open", { userId: Number(userId) });
            await openThread(data.id);
        } catch (err) {
            toast(err.message, "err");
            await showList();
        }
    } else {
        await showList();
    }
};

const closeChat = () => {
    chatBox.hidden = true;
    document.body.classList.remove("chat-on");
    chatId = null;
    chatPop.hidden = true;
};

const pollChat = async () => {
    if (chatBusy || chatBox.hidden || !currentUser) return;
    chatBusy = true;
    try {
        if (chatId) {
            const data = await api(`/chat/${chatId}?after=${lastMsg}`);
            if (chatId) paintThread(data, true);
        } else {
            await refreshUnread();
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
    chatInput.value = "";
    chatInput.style.height = "";
    try {
        const data = await api(`/chat/${chatId}`, { content });
        paintThread({ conversation: { nick: chatName.textContent, blocked: false, blocked_by: false, typing: false }, messages: [data.message] }, true);
    } catch (err) {
        chatInput.value = content;
        toast(err.message, "err");
    }
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
    if (!currentUser) {
        closeChat();
        setBadge(0);
        return;
    }
    refreshUnread();
});

chatTick = setInterval(pollChat, 2500);
refreshUnread();
