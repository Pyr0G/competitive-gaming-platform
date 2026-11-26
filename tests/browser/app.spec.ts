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

async function expectPaddedDialogForm(dialog: Locator) {
  await expect(dialog).toBeVisible();
  const form = dialog.locator(".dialog-inner > .form-stack");
  await expect(form).toBeVisible();
  const layout = await form.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      padding: [
        style.paddingBlockStart,
        style.paddingBlockEnd,
        style.paddingInlineStart,
        style.paddingInlineEnd,
      ].map(parseFloat),
      fitsWidth: element.scrollWidth <= element.clientWidth,
    };
  });
  expect(Math.min(...layout.padding)).toBeGreaterThanOrEqual(20);
  expect(layout.fitsWidth).toBe(true);
  await expect(form).toHaveCSS("overflow-y", "auto");
}

async function expectNoHorizontalOverflow(page: Page, ...elements: Locator[]) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  for (const element of elements) {
    await expect(element).toBeVisible();
    await expect
      .poll(() =>
        element.evaluate((node) => node.scrollWidth <= node.clientWidth),
      )
      .toBe(true);
  }
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

test("shows home updates and section links, supports keyboard dialogs and has a working mobile navigation", async ({
  page,
  browser,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const home = page.getByRole("main");
  const homeTitle = "Find players. Build teams. Compete.";
  await expect(
    home.getByRole("heading", { name: homeTitle, exact: true }),
  ).toBeVisible();
  await expect(
    home.getByRole("heading", { name: "Updates", exact: true }),
  ).toBeVisible();
  await expect(
    home.getByRole("heading", { name: "No updates yet", exact: true }),
  ).toBeVisible();
  await expect(
    home.getByRole("link", { name: "Create account", exact: true }),
  ).toHaveAttribute("href", "/register");
  const sidebar = page.locator(".sidebar");
  const sections = [
    { name: "Tournaments", path: "/tournaments" },
    { name: "Teams", path: "/teams" },
    { name: "Recruitment", path: "/recruitment" },
    { name: "Rankings", path: "/rankings" },
  ];
  await expect(sidebar.getByRole("link")).toHaveCount(6);
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
  await expect(sidebar.getByRole("button")).toHaveCount(0);
  await expect(sidebar.locator("nav > :last-child")).toHaveText("Guide");
  await expect(sidebar.locator("nav > :nth-last-child(2)")).toContainText(
    "Rankings",
  );
  await expect(sidebar).not.toContainText(/Map veto|Counter-Strike 2|Home/);
  for (const { name, path } of sections) {
    await expect(
      sidebar.getByRole("link", { name, exact: true }),
    ).toHaveAttribute("href", path);
    await expect(
      home.getByRole("link", { name: `${name} Open`, exact: true }),
    ).toHaveAttribute("href", path);
  }
  for (const { name, path } of sections) {
    const link = sidebar.getByRole("link", { name, exact: true });
    await link.click();
    await expect(page).toHaveURL(`${origin}${path}`);
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(
      home.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  const rankingsTabs = home.locator(".tabs");
  const tournamentRanking = rankingsTabs.getByRole("button", {
    name: "Tournament ranking",
    exact: true,
  });
  await expect(rankingsTabs).toHaveCSS("overflow-x", "visible");
  await expect(rankingsTabs).toHaveCSS("overflow-y", "visible");
  await tournamentRanking.hover();
  await expect(tournamentRanking).toHaveCSS("box-shadow", "none");
  await tournamentRanking.click();
  await expect(tournamentRanking).toHaveClass("active");
  await expect(tournamentRanking).toHaveCSS(
    "border-bottom-color",
    "rgb(255, 70, 85)",
  );
  await expect(
    rankingsTabs.getByRole("button", { name: "Global ranking", exact: true }),
  ).toHaveCSS("border-bottom-color", "rgba(0, 0, 0, 0)");
  await expect(
    home.getByRole("heading", {
      name: "Tournament standings are empty",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("rankings-tabs.png") });
  await sidebar.getByRole("link", { name: "Home", exact: true }).click();
  await expect(
    home.getByRole("heading", { name: homeTitle, exact: true }),
  ).toBeVisible();
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
  await expect(
    searchDialog.getByRole("tab", { name: "Teams", exact: true }),
  ).toBeEnabled();
  await expect(
    searchDialog.getByRole("tab", { name: "Tournaments", exact: true }),
  ).toBeDisabled();
  await expect(
    searchDialog.getByText("Tournament search will be available later.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await searchDialog.evaluate((element) => ({
      background: getComputedStyle(element, "::backdrop").backgroundColor,
      filter: getComputedStyle(element, "::backdrop").backdropFilter,
    })),
  ).toEqual({ background: "rgba(0, 0, 0, 0)", filter: "none" });
  await page.keyboard.press("Escape");
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
  await expect(
    home.getByRole("heading", { name: homeTitle, exact: true }),
  ).toBeVisible();
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Create account", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    home.getByRole("heading", { name: homeTitle, exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("home-desktop.png") });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "en-GB",
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(origin);
  await expect(mobilePage.getByRole("contentinfo")).toBeVisible();
  await expect(
    mobilePage.getByRole("heading", { name: homeTitle, exact: true }),
  ).toBeVisible();
  await mobilePage.getByRole("button", { name: "Open navigation" }).click();
  const mobileNav = mobilePage.getByRole("dialog", { name: "Main navigation" });
  await expect(mobileNav).toBeVisible();
  await expect(
    mobilePage
      .getByRole("dialog")
      .getByRole("img", { name: "CGP", exact: true }),
  ).toBeVisible();
  for (const { name, path } of sections) {
    await expect(
      mobileNav.getByRole("link", { name, exact: true }),
    ).toHaveAttribute("href", path);
  }
  await mobileNav.getByRole("link", { name: "Teams", exact: true }).focus();
  await mobilePage.keyboard.press("Enter");
  await expect(mobilePage).toHaveURL(`${origin}/teams`);
  await expect(mobileNav).toHaveCount(0);
  await expect(
    mobilePage
      .getByRole("main")
      .getByRole("heading", { name: "Teams", exact: true }),
  ).toBeVisible();
  await mobilePage.getByRole("button", { name: "Open navigation" }).click();
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
  await expect(
    mobilePage
      .getByRole("main")
      .getByRole("heading", { name: homeTitle, exact: true }),
  ).toBeVisible();
  await mobilePage.setViewportSize({ width: 320, height: 740 });
  expect(
    await mobilePage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mobilePage.screenshot({ path: info.outputPath("home-mobile.png") });
  await mobilePage.getByRole("button", { name: "Open navigation" }).click();
  await mobileNav.getByRole("link", { name: "Rankings", exact: true }).click();
  const mobileRankingsTabs = mobilePage.getByRole("main").locator(".tabs");
  await expect(mobileRankingsTabs).toBeVisible();
  await expect(mobileRankingsTabs).toHaveCSS("overflow-y", "visible");
  await expect(mobileRankingsTabs).toHaveCSS("flex-wrap", "wrap");
  expect(
    await mobilePage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
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
  await page
    .getByRole("contentinfo")
    .getByRole("button", { name: "Szukaj w CGP", exact: true })
    .click();
  const search = page.getByRole("dialog", {
    name: "Szukaj w CGP",
    exact: true,
  });
  await expect(
    search.getByRole("tab", { name: "Drużyny", exact: true }),
  ).toBeEnabled();
  await expect(
    search.getByRole("tab", { name: "Turnieje", exact: true }),
  ).toBeDisabled();
  await expect(
    search.getByText("Wyszukiwanie turniejów będzie dostępne później.", {
      exact: true,
    }),
  ).toBeVisible();
  await search.getByRole("tab", { name: "Drużyny", exact: true }).click();
  await expect(
    search.getByText("Wyszukaj drużynę po nazwie lub tagu.", { exact: true }),
  ).toBeVisible();
  await search
    .getByRole("textbox", { name: "Szukaj w CGP", exact: true })
    .fill("przykladowa-druzyna");
  await expect(
    search.getByText("Nie znaleziono drużyn.", { exact: true }),
  ).toBeVisible();
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

test("publishes home updates and lets administrators manage older posts with retry feedback", async ({
  browser,
  page,
}, info) => {
  const admin = await createUser(browser, "BrowserNewsAdmin");
  const featuredTitle = "A".repeat(120);
  const secondaryTitle = "B".repeat(120);
  const archived = Array.from({ length: 50 }, (_, index) => ({
    id: crypto.randomUUID(),
    title: index === 49 ? secondaryTitle : `Archive update ${index + 1}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
  }));
  const oldest = archived[0];
  try {
    sql(`UPDATE users SET is_admin = 1 WHERE id = '${admin.account.id}';
      INSERT INTO posts (id, author_id, title, body, created_at, updated_at) VALUES ${archived
        .map(
          (post) =>
            `('${post.id}', '${admin.account.id}', '${post.title}', 'Synthetic archived update.', '${post.createdAt}', '${post.createdAt}')`,
        )
        .join(",")};`);
    await admin.page.goto("/admin");
    const panel = admin.page.locator(".admin-panel");
    const cards = panel.getByRole("article");
    const loadMore = panel.getByRole("button", {
      name: "Load more",
      exact: true,
    });
    await admin.page
      .getByRole("button", { name: "Updates", exact: true })
      .click();
    await expect(cards).toHaveCount(25);
    await panel
      .getByRole("button", { name: "New update", exact: true })
      .click();
    const editor = admin.page.getByRole("dialog", {
      name: "New update",
      exact: true,
    });
    await expectPaddedDialogForm(editor);
    await admin.page.screenshot({ path: info.outputPath("update-dialog.png") });
    await editor.getByLabel("Title", { exact: true }).fill(featuredTitle);
    await editor
      .getByLabel("Body", { exact: true })
      .fill("A synthetic public update.");
    const banner = editor.getByRole("textbox", { name: "Banner image URL" });
    const save = editor.getByRole("button", {
      name: "Save changes",
      exact: true,
    });
    await banner.fill("https://a");
    await expect(banner).toHaveAttribute("aria-invalid", "true");
    await expect(save).toBeDisabled();
    await banner.fill("HTTPS://example.com/banner.jpg");
    await expect(banner).toHaveAttribute("aria-invalid", "false");
    await expect(save).toBeEnabled();
    await editor.getByRole("button", { name: "Remove banner" }).click();
    await expect(banner).toHaveValue("");
    await save.click();
    await expect(
      panel.getByText("Update saved.", { exact: true }),
    ).toBeVisible();
    await expect(cards).toHaveCount(25);

    await page.goto("/");
    const news = page.locator(".home-news");
    const featuredHeading = news.getByRole("heading", {
      name: featuredTitle,
      exact: true,
    });
    const secondaryHeading = news.getByRole("heading", {
      name: secondaryTitle,
      exact: true,
    });
    await expect(featuredHeading).toBeVisible();
    await expect(secondaryHeading).toBeVisible();
    await expect(news.getByRole("article")).toHaveCount(4);
    await expect(news.getByText(oldest.title, { exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("home-updates.png") });
    await page.setViewportSize({ width: 320, height: 740 });
    await expectNoHorizontalOverflow(
      page,
      news,
      news.locator(".home-news-grid"),
      featuredHeading,
      secondaryHeading,
    );
    await page.screenshot({ path: info.outputPath("home-updates-mobile.png") });

    const adminViewport = admin.page.viewportSize()!;
    await admin.page.setViewportSize({ width: 320, height: 740 });
    const featuredCard = cards.filter({
      has: admin.page.getByText(featuredTitle, { exact: true }),
    });
    await expectNoHorizontalOverflow(
      admin.page,
      panel,
      featuredCard,
      featuredCard.getByText(featuredTitle, { exact: true }),
    );
    await admin.page.screenshot({
      path: info.outputPath("admin-updates-mobile.png"),
    });
    await admin.page.setViewportSize(adminViewport);

    await loadMore.click();
    await expect(cards).toHaveCount(50);
    await loadMore.click();
    await expect(cards).toHaveCount(51);
    await expect(loadMore).toHaveCount(0);
    const oldestCard = cards.filter({
      has: admin.page.getByText(oldest.title, { exact: true }),
    });
    await oldestCard
      .getByRole("button", { name: "Edit update", exact: true })
      .click();
    const edit = admin.page.getByRole("dialog", {
      name: "Edit update",
      exact: true,
    });
    await expectPaddedDialogForm(edit);
    await edit
      .getByRole("textbox", { name: "Body", exact: true })
      .fill("Edited archive update.");
    await edit
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      panel.getByText("Update saved.", { exact: true }),
    ).toBeVisible();
    await expect(cards).toHaveCount(25);
    await loadMore.click();
    await expect(cards).toHaveCount(50);
    await loadMore.click();
    await expect(cards).toHaveCount(51);
    await expect(
      oldestCard.getByText("Edited archive update.", { exact: true }),
    ).toBeVisible();

    const postUrl = `**/api/admin/posts/${oldest.id}`;
    await admin.page.route(postUrl, async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 503,
          json: { error: { code: "SERVICE_UNAVAILABLE" } },
        });
      } else {
        await route.continue();
      }
    });
    await oldestCard
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(oldestCard.getByRole("alert")).toHaveText(
      "This action is currently unavailable.",
    );
    await expect(
      oldestCard.getByText("Edited archive update.", { exact: true }),
    ).toBeVisible();
    await admin.page.unroute(postUrl);
    await oldestCard
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(
      panel.getByText("Update deleted.", { exact: true }),
    ).toBeVisible();
    await expect(cards).toHaveCount(25);
    await loadMore.click();
    await expect(cards).toHaveCount(50);
    await expect(loadMore).toHaveCount(0);
    await expect(oldestCard).toHaveCount(0);
  } finally {
    await admin.context.close();
  }
});

test("creates and searches public teams, exposes their rosters and opens the recruitment preview", async ({
  browser,
  page,
}, info) => {
  const captain = await createUser(browser, "BrowserCaptain");
  const teamName = "Browser" + "T".repeat(25);
  try {
    await captain.page.goto("/teams");
    await captain.page
      .locator(".section-toolbar")
      .getByRole("button", { name: "Create team", exact: true })
      .click();
    const create = captain.page.getByRole("dialog", {
      name: "Create team",
      exact: true,
    });
    await expectPaddedDialogForm(create);
    await captain.page.screenshot({
      path: info.outputPath("team-create-dialog.png"),
    });
    await create.getByLabel(/^Team name/).fill(teamName);
    await create.getByLabel(/^Tag/).fill("BRT");
    await create
      .getByRole("button", { name: "Create team", exact: true })
      .click();
    await expect(captain.page).toHaveURL(/\/teams\/[a-f0-9-]+$/);
    await expect(
      captain.page.getByRole("heading", { name: teamName, exact: true }),
    ).toBeVisible();
    const teamPath = new URL(captain.page.url()).pathname;
    const extraTeams = Array.from({ length: 21 }, (_, index) => ({
      id: crypto.randomUUID(),
      name: `Browser Search ${String(index + 1).padStart(2, "0")}`,
      tag: `BS${String(index + 1).padStart(2, "0")}`,
    }));
    sql(
      `INSERT INTO teams (id, name, name_key, tag, tag_key, captain_id, created_at) VALUES ${extraTeams
        .map(
          (team) =>
            `('${team.id}', '${team.name}', '${team.name.toLowerCase()}', '${team.tag}', '${team.tag.toLowerCase()}', '${captain.account.id}', '2026-01-01T12:00:00.000Z')`,
        )
        .join(
          ",",
        )}; INSERT INTO team_members (team_id, user_id, role) VALUES ${extraTeams
        .map((team) => `('${team.id}', '${captain.account.id}', 'captain')`)
        .join(",")};`,
    );
    await page.goto("/teams");
    const directory = page.getByRole("main");
    const directorySearch = directory.getByRole("textbox", {
      name: "Search teams by name or tag",
      exact: true,
    });
    const directoryTeams = directory.locator(".entity-list").getByRole("link");
    const directoryMore = directory.getByRole("button", {
      name: "Load more",
      exact: true,
    });
    await directorySearch.fill("browser");
    await expect(directoryTeams).toHaveCount(20);
    await directoryMore.click();
    await expect(directoryTeams).toHaveCount(22);
    await expect(directoryMore).toHaveCount(0);
    await directorySearch.fill("bs01");
    await expect(directoryTeams).toHaveCount(1);
    await expect(directoryTeams.first()).toContainText("Browser Search 01");
    await directorySearch.fill("unmatched tag");
    await expect(
      directory.getByText("No teams match your search.", { exact: true }),
    ).toBeVisible();
    await directory
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    await expect(directoryTeams).toHaveCount(20);
    await directorySearch.fill("brt");
    await expect(directoryTeams).toHaveCount(1);
    await expect(directoryTeams.first()).toContainText(teamName);
    await expect(directoryTeams.first()).toContainText(/1 member\b/);
    await page.screenshot({
      path: info.outputPath("team-directory-search.png"),
    });
    await page.setViewportSize({ width: 320, height: 740 });
    await expectNoHorizontalOverflow(
      page,
      directoryTeams.first(),
      directoryTeams.first().getByText(teamName, { exact: true }),
    );
    await directoryTeams.first().click();
    const teamHeading = page.getByRole("heading", {
      name: teamName,
      exact: true,
    });
    await expect(
      page.getByRole("heading", { name: "Roster", exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(
      page,
      page.locator(".team-header"),
      teamHeading,
    );
    const member = page.getByRole("link", { name: /BrowserCaptain/ });
    await expect(member).toContainText("Captain");
    await expect(member).toHaveAttribute(
      "href",
      `/players/${captain.account.id}`,
    );
    await page.screenshot({ path: info.outputPath("public-team-mobile.png") });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: info.outputPath("public-team.png") });

    await page.goto("/");
    await page.keyboard.press("Control+k");
    const globalSearch = page.getByRole("dialog", {
      name: "Search CGP",
      exact: true,
    });
    const globalInput = globalSearch.getByRole("textbox", {
      name: "Search CGP",
      exact: true,
    });
    const playerResults = globalSearch.getByRole("region", {
      name: "Players",
      exact: true,
    });
    const teamResults = globalSearch.getByRole("region", {
      name: "Teams",
      exact: true,
    });
    const teamLink = teamResults.getByRole("link", {
      name: `View team ${teamName} (BRT)`,
      exact: true,
    });
    await globalInput.fill("browser");
    await expect(
      playerResults.getByRole("link", {
        name: "View profile for BrowserCaptain",
        exact: true,
      }),
    ).toBeVisible();
    await expect(teamResults.getByRole("link")).toHaveCount(20);
    await expect(teamLink).toBeVisible();
    await teamResults
      .getByRole("button", { name: "Load more", exact: true })
      .click();
    await expect(teamResults.getByRole("link")).toHaveCount(22);
    await globalSearch
      .getByRole("tab", { name: "Players", exact: true })
      .click();
    await expect(teamResults).toHaveCount(0);
    await expect(
      playerResults.getByRole("link", {
        name: "View profile for BrowserCaptain",
        exact: true,
      }),
    ).toBeVisible();
    await globalSearch.getByRole("tab", { name: "Teams", exact: true }).click();
    await expect(playerResults).toHaveCount(0);
    await expect(teamResults.getByRole("link")).toHaveCount(22);
    await globalInput.fill("unmatched tag");
    await expect(
      teamResults.getByText("No teams found.", { exact: true }),
    ).toBeVisible();
    await globalInput.fill("brt");
    await expect(teamResults.getByRole("link")).toHaveCount(1);
    await expect(teamLink).toBeVisible();
    await expect(teamLink).toContainText(/1 member\b/);
    await page.screenshot({ path: info.outputPath("team-global-search.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await globalSearch.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await teamLink.click();
    await expect(globalSearch).toHaveCount(0);
    await expect(page).toHaveURL(`${origin}${teamPath}`);

    await captain.page.goto("/recruitment");
    await captain.page
      .getByRole("button", { name: "Create listing", exact: true })
      .click();
    const listing = captain.page.getByRole("dialog", {
      name: "Create listing",
      exact: true,
    });
    await expectPaddedDialogForm(listing);
    await captain.page.screenshot({
      path: info.outputPath("listing-dialog.png"),
    });
    const close = listing
      .getByRole("button", { name: "Close", exact: true })
      .last();
    await close.click();
    await expect(listing).toHaveCount(0);
    await captain.page
      .getByRole("button", { name: "Create listing", exact: true })
      .click();
    await captain.page.setViewportSize({ width: 320, height: 560 });
    await expectPaddedDialogForm(listing);
    const listingForm = listing.locator(".form-stack");
    expect(
      await listingForm.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
    const header = listing.locator(".dialog-header");
    const headerBefore = await header.boundingBox();
    await listing
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("short");
    await listing
      .getByRole("spinbutton", { name: "Level", exact: true })
      .fill("11");
    expect(
      await listingForm.evaluate(
        (element) => !(element as HTMLFormElement).checkValidity(),
      ),
    ).toBe(true);
    await close.scrollIntoViewIfNeeded();
    const headerAfter = await header.boundingBox();
    expect(headerAfter?.y).toBe(headerBefore?.y);
    await captain.page.screenshot({
      path: info.outputPath("listing-dialog-mobile.png"),
    });
    await close.click();
    await expect(listing).toHaveCount(0);

    sql(
      `UPDATE users SET banned_at = '2026-01-01T12:00:00.000Z', ban_reason = 'Synthetic moderation' WHERE id = '${captain.account.id}';`,
    );
    try {
      await page.goto(teamPath);
      await expect(teamHeading).toBeVisible();
      await expect(
        page.getByText("Captain unavailable", { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByText("No public roster members.", { exact: true }),
      ).toBeVisible();
      await expect(member).toHaveCount(0);
      await page.goto("/teams");
      await directorySearch.fill("brt");
      await expect(directoryTeams).toHaveCount(1);
      await expect(directoryTeams.first()).toContainText("Captain unavailable");
      await expect(directoryTeams.first()).toContainText("0 members");
    } finally {
      sql(
        `UPDATE users SET banned_at = NULL, ban_reason = NULL WHERE id = '${captain.account.id}';`,
      );
    }
    await page.goto(teamPath);
    await expect(member).toHaveAttribute(
      "href",
      `/players/${captain.account.id}`,
    );
  } finally {
    await captain.context.close();
  }
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
