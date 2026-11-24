import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type Locator,
} from "@playwright/test";
import { sql } from "./database";
import type { AuthResponse } from "../../shared/contracts";

const password = "A synthetic browser password 42!";
const origin = "http://127.0.0.1:5174";

async function expectClearBackdrop(dialog: Locator) {
  expect(
    await dialog.evaluate((element) => ({
      color: getComputedStyle(element, "::backdrop").backgroundColor,
      filter: getComputedStyle(element, "::backdrop").backdropFilter,
    })),
  ).toEqual({ color: "rgba(0, 0, 0, 0)", filter: "none" });
}

async function createUser(browser: Browser, username: string) {
  const context = await browser.newContext({ locale: "en-GB" });
  const response = await context.request.post(`${origin}/api/auth/register`, {
    headers: { Origin: origin },
    data: {
      username,
      email: `${username.toLowerCase()}@example.com`,
      password,
      passwordConfirmation: password,
    },
  });
  expect(response.status()).toBe(201);
  const auth = (await response.json()) as AuthResponse;
  return {
    context,
    page: await context.newPage(),
    account: auth.account!,
    csrf: auth.csrfToken!,
  };
}

async function closeChat(page: Page) {
  await page
    .getByRole("dialog", { name: "Messages", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
}

test("keeps home empty, supports keyboard dialogs and has a working mobile navigation", async ({
  page,
  browser,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("main")).toBeEmpty();
  const sidebar = page.locator(".sidebar");
  await expect(sidebar.getByRole("link")).toHaveCount(2);
  await expect(
    sidebar.getByRole("link", { name: "Home", exact: true }),
  ).toBeVisible();
  const wordmark = sidebar.getByRole("img", { name: "CGP", exact: true });
  await expect(wordmark).toBeVisible();
  await expect
    .poll(() =>
      wordmark.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(360);
  const favicon = await page.request.get("/brand/favicon.png");
  expect(favicon.ok()).toBe(true);
  expect(favicon.headers()["content-type"]).toContain("image/png");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/brand/favicon.png",
  );
  await expect(sidebar.getByRole("button")).toHaveCount(4);
  await expect(sidebar.locator("nav > :last-child")).toHaveText("Guide");
  await expect(sidebar.locator("nav > :nth-last-child(2)")).toContainText(
    "Rankings",
  );
  await expect(sidebar).not.toContainText(/Map veto|Counter-Strike 2|Home/);
  await expect(page.locator(".search-trigger kbd")).toHaveCount(0);
  await expect
    .poll(() =>
      page.locator(".search-trigger").evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return Math.abs(bounds.left + bounds.width / 2 - window.innerWidth / 2);
      }),
    )
    .toBeLessThan(1);
  const footer = page.getByRole("contentinfo");
  await expect(footer).toBeVisible();
  await expect(
    footer.getByRole("link", { name: "Guide", exact: true }),
  ).toHaveAttribute("href", "/guide");
  await expect(footer).toContainText(`© ${new Date().getFullYear()} CGP`);
  await footer.getByRole("button", { name: "Search CGP", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Search CGP" })).toBeVisible();
  const searchDialog = page.getByRole("dialog", { name: "Search CGP" });
  await expect(
    searchDialog.getByRole("textbox", { name: "Search CGP", exact: true }),
  ).toBeFocused();
  await expect(
    searchDialog.getByRole("heading", { name: "Search CGP", exact: true }),
  ).toHaveCount(0);
  expect(
    await searchDialog.evaluate((element) => ({
      background: getComputedStyle(element, "::backdrop").backgroundColor,
      filter: getComputedStyle(element, "::backdrop").backdropFilter,
    })),
  ).toEqual({ background: "rgba(0, 0, 0, 0)", filter: "none" });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /^Tournaments/ }),
  ).toBeDisabled();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Search CGP" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/login");
  const authLogo = page.locator(".auth-brand img");
  await expect
    .poll(() =>
      authLogo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(632);
  await page
    .getByLabel("Username or email", { exact: true })
    .fill("DismissPlayer");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Language & region", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByLabel("Username or email", { exact: true }),
  ).toHaveValue("DismissPlayer");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("main")).toBeEmpty();
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Create account", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: info.outputPath("home-desktop.png") });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "en-GB",
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(origin);
  await expect(mobilePage.getByRole("contentinfo")).toBeVisible();
  await mobilePage.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    mobilePage.getByRole("dialog", { name: "Main navigation" }),
  ).toBeVisible();
  await expect(
    mobilePage
      .getByRole("dialog")
      .getByRole("img", { name: "CGP", exact: true }),
  ).toBeVisible();
  await expect(
    mobilePage.getByRole("dialog").getByRole("button", { disabled: true }),
  ).toHaveCount(4);
  await mobilePage.keyboard.press("Escape");
  const mobileBrand = mobilePage
    .getByRole("banner")
    .getByRole("link", { name: "Home", exact: true });
  await expect(mobileBrand).toBeVisible();
  await expect
    .poll(() =>
      mobileBrand
        .locator("img")
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(256);
  await mobilePage.goto(`${origin}/guide`);
  await mobileBrand.click();
  await expect(mobilePage.getByRole("main")).toBeEmpty();
  await mobilePage.setViewportSize({ width: 320, height: 740 });
  expect(
    await mobilePage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mobilePage.screenshot({ path: info.outputPath("home-mobile.png") });
  await mobile.close();
  expect(errors).toEqual([]);
});

test("creates an account through the interface and saves public profile changes", async ({
  page,
}, info) => {
  await page.goto("/register");
  await page.getByLabel(/^Username/).fill("BrowserŁukasz");
  await page.getByLabel(/^Email address/).fill("browser-lukasz@example.com");
  await page.getByLabel(/^Password/).fill("Eight42!");
  await page.getByLabel("Confirm password", { exact: true }).fill("Eight42!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account$/);
  await page
    .getByLabel(/^About you/)
    .fill("<script>window.bad = true</script> A player biography.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Changes saved.");
  await page.getByLabel(/^Current password/).fill("A wrong synthetic password");
  await page.getByLabel(/^New password/).fill("A different long password 42!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("A different long password 42!");
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
  await expect(
    page.getByRole("heading", { name: "Your account", exact: true }),
  ).toBeVisible();
  const menu = page.locator(".account-menu");
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  await page
    .getByRole("heading", { name: "Your account", exact: true })
    .click();
  await expect(menu).not.toHaveAttribute("open", "");
  await menu.locator("summary").click();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(menu.locator("summary")).toBeFocused();
  await menu.locator("summary").click();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: "Search CGP", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  const auth = (await (
    await page.request.get("/api/auth/me")
  ).json()) as AuthResponse;
  await page.goto(`/players/${auth.account!.id}`);
  await expect(
    page.getByRole("heading", { name: "BrowserŁukasz", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("<script>window.bad = true</script> A player biography.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => "bad" in window)).toBe(false);
  await expect(
    page.getByText("This player has not added gaming details yet."),
  ).toBeVisible();
  await page.goto("/account");
  await page.getByLabel("Main CS2 role").selectOption("igl");
  await page.getByLabel("FACEIT level").selectOption("7");
  await page.getByRole("checkbox", { name: "Evenings" }).check();
  await page.getByRole("checkbox", { name: "Polish" }).check();
  await page.getByRole("checkbox", { name: "English" }).check();
  await page
    .getByRole("button", { name: "Save gaming profile", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Gaming profile saved.");
  await page.goto(`/players/${auth.account!.id}`);
  const gaming = page.locator(".profile-gaming");
  await expect(gaming).toContainText("Self-declared");
  await expect(gaming).toContainText("In-game leader");
  await expect(gaming).toContainText("Evenings");
  await expect(gaming.locator(".gaming-tags span")).toHaveText([
    "Evenings",
    "English",
    "Polish",
  ]);
  await page.screenshot({ path: info.outputPath("profile.png") });
});

test("disables all gaming profile controls while a save is pending", async ({
  browser,
}) => {
  const user = await createUser(browser, "GamingSavePlayer");
  const { page, context } = user;
  let releaseSave: () => void = () => {};
  let saveStarted: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  const started = new Promise<void>((resolve) => {
    saveStarted = resolve;
  });
  try {
    await page.goto("/account");
    const form = page.locator(".gaming-panel");
    const role = form.getByLabel("Main CS2 role");
    const level = form.getByLabel("FACEIT level");
    await role.selectOption("igl");
    await level.selectOption("7");
    await form.getByRole("checkbox", { name: "Evenings" }).check();
    await form.getByRole("checkbox", { name: "Polish" }).check();
    await page.route("**/api/account/gaming", async (route) => {
      const response = await route.fetch();
      saveStarted();
      await held;
      await route.fulfill({ response });
    });
    await form.getByRole("button", { name: "Save gaming profile" }).click();
    await started;
    await expect(role).toBeDisabled();
    await expect(level).toBeDisabled();
    for (const checkbox of await form.getByRole("checkbox").all()) {
      await expect(checkbox).toBeDisabled();
    }
    await expect(form.getByRole("button", { name: "Saving…" })).toBeDisabled();
    releaseSave();
    await expect(form.getByRole("status")).toHaveText("Gaming profile saved.");
    await expect(role).toBeEnabled();
    await expect(role).toHaveValue("igl");
    await expect(level).toBeEnabled();
    await expect(level).toHaveValue("7");
    await expect(
      form.getByRole("checkbox", { name: "Evenings" }),
    ).toBeChecked();
    await expect(
      form.getByRole("checkbox", { name: "Evenings" }),
    ).toBeEnabled();
    await expect(form.getByRole("checkbox", { name: "Polish" })).toBeChecked();
    await expect(form.getByRole("checkbox", { name: "Polish" })).toBeEnabled();
    await expect(
      form.getByRole("button", { name: "Save gaming profile" }),
    ).toBeEnabled();
  } finally {
    releaseSave();
    await context.close();
  }
});

test("clears old account state across tabs and ignores a save response arriving after logout", async ({
  browser,
}) => {
  const a = await createUser(browser, "SessionAlice");
  const b = await createUser(browser, "SessionBob");
  const otherTab = await a.context.newPage();
  let releaseSave: () => void = () => {};
  let saveStarted: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  const started = new Promise<void>((resolve) => {
    saveStarted = resolve;
  });
  try {
    await a.page.goto("/account");
    await otherTab.goto("/account");
    await expect(otherTab.getByLabel(/^Username/)).toHaveValue("SessionAlice");
    await a.page.route("**/api/account", async (route) => {
      const response = await route.fetch();
      saveStarted();
      await held;
      await route.fulfill({ response }).catch(() => {});
    });
    await a.page
      .getByLabel(/^About you/)
      .fill("This belongs only to SessionAlice.");
    await a.page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await started;
    await a.page.locator('summary[aria-label="Your account"]').click();
    await a.page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      a.page
        .getByRole("banner")
        .getByRole("link", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await expect(otherTab.getByLabel(/^Username/)).toHaveCount(0);
    await otherTab.goto("/login");
    await otherTab
      .getByLabel("Username or email", { exact: true })
      .fill(b.account.username);
    await otherTab.getByLabel("Password", { exact: true }).fill(password);
    await otherTab
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(otherTab.getByLabel(/^Username/)).toHaveValue("SessionBob");
    await expect(
      a.page.locator('summary[aria-label="Your account"]'),
    ).toBeVisible();
    releaseSave();
    await a.page.locator('summary[aria-label="Your account"]').click();
    await a.page
      .getByRole("link", { name: "Your account", exact: true })
      .click();
    await expect(a.page.getByLabel(/^Username/)).toHaveValue("SessionBob");
    await expect(a.page.getByLabel(/^About you/)).toHaveValue("");
    await expect(
      a.page.getByText("This belongs only to SessionAlice.", { exact: true }),
    ).toHaveCount(0);
  } finally {
    releaseSave();
    await Promise.allSettled([a.context.close(), b.context.close()]);
  }
});

test("shows flag choices and keeps language and region independent with keyboard controls", async ({
  page,
}, info) => {
  await page.goto("/");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Language & region", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Language & region",
    exact: true,
  });
  await expectClearBackdrop(dialog);
  const language = dialog.getByRole("combobox", {
    name: "Language",
    exact: true,
  });
  await language.click();
  await expect(
    page.getByRole("option", { name: "English", exact: true }).locator("img"),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("language-flags.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(language).toHaveAttribute("aria-expanded", "false");
  await language.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  const region = page.getByRole("combobox", { name: "Region", exact: true });
  await region.focus();
  await page.keyboard.press("p");
  await expect(
    page.getByRole("option", { name: "Polska", exact: true }),
  ).toHaveAttribute("data-active", "true");
  await page.keyboard.press("Enter");
  await expect(region.locator("img")).toHaveAttribute("src", "/flags/pl.svg");
  await region.click();
  await page.screenshot({ path: info.outputPath("region-flags.png") });
  await page
    .getByRole("option", { name: "Stany Zjednoczone", exact: true })
    .click();
  await expect(region.locator("img")).toHaveAttribute("src", "/flags/us.svg");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  const preferences = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cgp.preferences")!),
  );
  expect(preferences).toMatchObject({ language: "pl", region: "US" });
  await region.click();
  await page.locator(".locale-settings > p").click();
  await expect(region).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
});

test("changes language without losing a registration draft", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel(/^Username/).fill("DraftPlayer");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Language & region", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Language & region",
    exact: true,
  });
  await dialog.getByRole("combobox", { name: "Language", exact: true }).click();
  await page.getByRole("option", { name: "Polski", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Zamknij", exact: true })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.getByRole("contentinfo")).toContainText(
    "Wszelkie prawa zastrzeżone.",
  );
  await expect(
    page.getByText("Użyj 8–128 znaków. Spacje i menedżery haseł są dozwolone."),
  ).toBeVisible();
  await expect(page.getByLabel(/^Nazwa użytkownika/)).toHaveValue(
    "DraftPlayer",
  );
  await expect(
    page.getByRole("button", { name: "Utwórz konto", exact: true }),
  ).toBeVisible();
});

test("exchanges messages, reports evidence and moderates a user through separate accounts", async ({
  browser,
}, info) => {
  const a = await createUser(browser, "BrowserAlice");
  const b = await createUser(browser, "BrowserBob");
  const admin = await createUser(browser, "BrowserModerator");
  const contexts: BrowserContext[] = [a.context, b.context, admin.context];
  try {
    sql(`UPDATE users SET is_admin = 1 WHERE id = '${admin.account.id}';`);
    await a.page.goto(`/players/${b.account.id}`);
    await a.page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    const aDialog = a.page.getByRole("dialog", {
      name: "Messages",
      exact: true,
    });
    await expect(
      aDialog.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible();
    await expectClearBackdrop(aDialog);
    await aDialog
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Hello Bob, a real persisted message.");
    await aDialog
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      aDialog
        .getByRole("log")
        .getByText("Hello Bob, a real persisted message.", { exact: true }),
    ).toBeVisible();
    await b.page.goto("/");
    await b.page
      .getByRole("button", { name: "Open notifications", exact: true })
      .click();
    await expectClearBackdrop(b.page.locator(".notification-dialog"));
    await b.page
      .getByRole("dialog")
      .getByRole("button", { name: /New message from BrowserAlice/ })
      .click();
    const bDialog = b.page.getByRole("dialog", {
      name: "Messages",
      exact: true,
    });
    await expect(
      bDialog
        .getByRole("log")
        .getByText("Hello Bob, a real persisted message.", { exact: true }),
    ).toBeVisible();
    await bDialog
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Hello Alice, received.");
    await bDialog
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await a.page.bringToFront();
    await expect(
      aDialog
        .getByRole("log")
        .getByText("Hello Alice, received.", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await b.page.bringToFront();
    await bDialog
      .getByRole("button", { name: "Report message", exact: true })
      .click();
    const report = b.page.getByRole("dialog", {
      name: "Report a player",
      exact: true,
    });
    await report
      .getByLabel("Reason", { exact: true })
      .fill("Synthetic moderation report for testing.");
    await report
      .getByRole("button", { name: "Submit report", exact: true })
      .click();
    await expect(report.getByRole("status")).toContainText("Report submitted");
    await report
      .getByRole("button", { name: "Close", exact: true })
      .first()
      .click();
    await bDialog
      .getByRole("button", { name: "Block player", exact: true })
      .click();
    await expect(
      bDialog.getByText("Messaging is unavailable while a block is active.", {
        exact: true,
      }),
    ).toBeVisible();
    await bDialog
      .getByRole("button", { name: "Unblock player", exact: true })
      .click();
    await expect(
      bDialog.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible();
    await closeChat(b.page);
    await admin.page.goto("/admin");
    await admin.page
      .getByRole("button", { name: "Reports", exact: true })
      .click();
    await expect(
      admin.page.getByText("Synthetic moderation report for testing.", {
        exact: true,
      }),
    ).toBeVisible();
    await admin.page.getByText("Reported message", { exact: true }).click();
    await expect(
      admin.page.getByText("Hello Bob, a real persisted message.", {
        exact: true,
      }),
    ).toBeVisible();
    await admin.page
      .getByRole("button", { name: "Resolve report", exact: true })
      .click();
    const resolution = admin.page.getByRole("dialog", {
      name: "Resolve report",
      exact: true,
    });
    await resolution.getByRole("textbox").fill("Reviewed synthetic evidence.");
    await resolution
      .getByRole("button", { name: "Resolve report", exact: true })
      .click();
    await expect(resolution).toHaveCount(0);
    await admin.page
      .getByRole("button", { name: "Users", exact: true })
      .click();
    await admin.page
      .getByRole("textbox", { name: "Search users", exact: true })
      .fill("BrowserAlice");
    const targetRow = admin.page.getByRole("row").filter({
      has: admin.page.getByRole("link", {
        name: "BrowserAlice",
        exact: true,
      }),
    });
    await targetRow
      .getByRole("button", { name: "Ban user", exact: true })
      .click();
    const ban = admin.page.getByRole("dialog", { name: /Ban BrowserAlice/ });
    await ban.getByRole("textbox").fill("Synthetic moderation action.");
    await ban.getByRole("button", { name: "Ban user", exact: true }).click();
    await expect(ban).toHaveCount(0);
    await expect(admin.page.getByText("Banned", { exact: true })).toBeVisible();
    await admin.page
      .getByRole("button", { name: "Unban user", exact: true })
      .click();
    const unban = admin.page.getByRole("dialog", {
      name: /Unban BrowserAlice/,
    });
    await unban.getByRole("textbox").fill("Synthetic appeal accepted.");
    await unban
      .getByRole("button", { name: "Unban user", exact: true })
      .click();
    await expect(unban).toHaveCount(0);
    await admin.page
      .getByRole("button", { name: "Action log", exact: true })
      .click();
    await expect(
      admin.page.getByText("Synthetic appeal accepted.", { exact: true }),
    ).toBeVisible();
    await admin.page.screenshot({ path: info.outputPath("admin.png") });
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});
