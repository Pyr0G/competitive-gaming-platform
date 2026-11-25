import { expect, test } from "@playwright/test";

test("explores the six Guide chapters with local tournament, recruitment and veto previews", async ({
  page,
}, info) => {
  const requests: string[] = [];
  const external: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/"))
      requests.push(`${request.method()} ${url.pathname}`);
    if (url.protocol.startsWith("http") && url.hostname !== "127.0.0.1")
      external.push(url.origin);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Updates", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".home-news .loading")).toHaveCount(0);
  requests.length = 0;
  const guide = page
    .locator(".sidebar")
    .getByRole("link", { name: "Guide", exact: true });
  await guide.click();
  await expect(guide).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".guide-chapter")).toHaveCount(6);
  await expect(page.locator(".guide-chapter-heading h2")).toHaveText([
    "How it works",
    "Tournaments",
    "Find a team or recruit a player",
    "Tournament bracket",
    "Rankings",
    "Map veto",
  ]);
  await expect(
    page.getByRole("navigation", { name: "Guide sections" }).getByRole("link"),
  ).toHaveCount(6);
  const tutorialSteps = page.locator(".guide-tutorial-steps button");
  await tutorialSteps.nth(1).click();
  await expect(page.locator(".guide-mock-listing")).toHaveCount(2);
  await tutorialSteps.nth(2).click();
  await expect(page.locator(".guide-mock-chat .guide-bubble")).toHaveCount(3);
  await tutorialSteps.nth(3).click();
  await expect(page.locator(".guide-mock-checks li")).toHaveCount(4);
  await tutorialSteps.first().click();
  await page.locator("#guide-how").screenshot({
    path: info.outputPath("guide-how-desktop.png"),
    animations: "disabled",
  });

  const events = page.getByRole("region", { name: "Tournaments", exact: true });
  await expect(events.getByRole("article")).toHaveCount(4);
  await events
    .getByRole("group")
    .getByRole("button", { name: /^Registration open/ })
    .click();
  await expect(events.getByRole("article")).toHaveCount(2);
  const weekend = events.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Weekend Cup", exact: true }),
  });
  await expect(
    weekend.getByRole("button", { name: "Register team", exact: true }),
  ).toBeDisabled();
  await weekend
    .getByRole("link", { name: "Registered teams", exact: true })
    .click();
  const bracket = page.getByRole("region", {
    name: "Tournament bracket",
    exact: true,
  });
  await expect(bracket.locator(".guide-registered-teams li")).toHaveCount(5);
  await bracket
    .getByRole("button", { name: "View Atlas roster", exact: true })
    .click();
  const roster = page.getByRole("dialog", { name: "Atlas", exact: true });
  await expect(roster.getByRole("listitem")).toHaveCount(5);
  await roster.getByText("Planned team permissions", { exact: true }).click();
  await expect(
    roster.getByText(/Players would accept invitations/),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(roster).toHaveCount(0);
  await events
    .getByRole("group")
    .getByRole("button", { name: /^All / })
    .click();
  await events.screenshot({
    path: info.outputPath("guide-events-desktop.png"),
    animations: "disabled",
  });
  await events
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Opening Tournament",
        exact: true,
      }),
    })
    .getByRole("link", { name: "View bracket", exact: true })
    .click();
  await expect(bracket.locator(".guide-match")).toHaveCount(7);
  await bracket
    .getByRole("button", { name: "View match: Atlas vs Orbit", exact: true })
    .click();
  await expect(
    bracket.getByRole("complementary", { name: "Match details" }),
  ).toContainText("Mirage");
  await bracket.screenshot({
    path: info.outputPath("guide-bracket-desktop.png"),
    animations: "disabled",
  });

  const recruitment = page.getByRole("region", {
    name: "Find a team or recruit a player",
    exact: true,
  });
  await expect(recruitment.getByRole("article")).toHaveCount(4);
  await recruitment
    .getByRole("combobox", { name: "In-game role", exact: true })
    .selectOption("awp");
  await recruitment
    .getByRole("combobox", { name: "FACEIT level", exact: true })
    .selectOption("8-10");
  await recruitment
    .getByRole("combobox", { name: "Availability", exact: true })
    .selectOption("nights");
  await expect(recruitment.getByRole("article")).toHaveCount(1);
  await expect(recruitment.getByRole("article")).toContainText("Nova");
  await recruitment
    .getByRole("button", { name: "Message", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Conversation preview" }),
  ).toContainText("No message is sent");
  await page.keyboard.press("Escape");
  await recruitment
    .getByRole("combobox", { name: "Availability", exact: true })
    .selectOption("weekends");
  await expect(
    recruitment.getByText("No example listings match these filters.", {
      exact: true,
    }),
  ).toBeVisible();
  await recruitment
    .getByRole("combobox", { name: "In-game role", exact: true })
    .selectOption("");
  await recruitment
    .getByRole("combobox", { name: "FACEIT level", exact: true })
    .selectOption("");
  await recruitment
    .getByRole("combobox", { name: "Availability", exact: true })
    .selectOption("");
  await recruitment
    .getByRole("button", { name: "Create a listing", exact: true })
    .click();
  const listing = page.getByRole("dialog", {
    name: "Listing preview",
    exact: true,
  });
  await listing
    .getByLabel("Description", { exact: true })
    .fill("Scheduled evening practice with a regular team.");
  await listing
    .getByRole("button", { name: "Preview listing", exact: true })
    .click();
  await expect(listing.getByRole("status")).toContainText(
    "Nothing was published or saved",
  );
  await page.keyboard.press("Escape");
  await recruitment.screenshot({
    path: info.outputPath("guide-recruitment-desktop.png"),
    animations: "disabled",
  });

  const rankings = page.getByRole("region", { name: "Rankings", exact: true });
  await expect(rankings.getByRole("row")).toHaveCount(9);
  expect(
    await rankings
      .locator(".guide-rankings-table")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  const matchCount = rankings
    .locator(".guide-facts > div")
    .filter({ hasText: "Matches completed" })
    .locator("dd");
  await expect(matchCount).toHaveText("8");
  await rankings.screenshot({
    path: info.outputPath("guide-rankings-desktop.png"),
    animations: "disabled",
  });
  await bracket
    .getByRole("group", { name: "Choose an example tournament" })
    .getByRole("button", { name: "Community Cup", exact: true })
    .click();
  const reference = bracket.getByLabel("FACEIT match link", { exact: true });
  await reference.fill(
    "https://faceit.com.example.invalid/en/cs2/room/1-example",
  );
  await bracket
    .getByRole("button", { name: "Preview result", exact: true })
    .click();
  await expect(bracket.getByRole("alert")).toContainText(
    "Use an HTTPS FACEIT CS2 room link",
  );
  await bracket
    .getByRole("button", { name: "Use example link", exact: true })
    .click();
  const sample = await reference.inputValue();
  await bracket
    .getByRole("button", { name: "Preview result", exact: true })
    .click();
  await expect(bracket.getByRole("status")).toContainText("Helix wins 13–9");
  await expect(matchCount).toHaveText("9");
  await expect(
    bracket.getByRole("button", {
      name: "View match: North vs Helix",
      exact: true,
    }),
  ).toBeVisible();
  await bracket
    .getByRole("button", { name: "Preview result", exact: true })
    .click();
  await expect(bracket.getByRole("alert")).toContainText("already been used");
  await reference.fill(sample.replace(/.$/, "9"));
  await bracket
    .getByRole("button", { name: "Preview result", exact: true })
    .click();
  await expect(bracket.getByRole("status")).toContainText("North wins 13–9");
  await expect(matchCount).toHaveText("10");
  await expect(bracket.locator(".guide-champion")).toContainText("North");
  await bracket
    .getByRole("button", { name: "Reset tournament examples", exact: true })
    .click();
  await expect(matchCount).toHaveText("8");

  const veto = page.getByRole("region", { name: "Map veto", exact: true });
  await expect(
    veto.getByRole("button", { name: "BO3", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const [action, map] of [
    ["Ban", "Mirage"],
    ["Ban", "Inferno"],
    ["Pick", "Nuke"],
    ["Pick", "Ancient"],
    ["Ban", "Anubis"],
    ["Ban", "Dust II"],
  ])
    await veto
      .getByRole("button", { name: `${action} ${map}`, exact: true })
      .click();
  await expect(veto.getByRole("status")).toHaveText(
    "Series maps: Nuke, Ancient and Overpass.",
  );
  await expect(
    veto
      .getByRole("list", { name: "Selected maps in play order" })
      .getByRole("listitem"),
  ).toHaveCount(3);
  await veto.screenshot({
    path: info.outputPath("guide-veto-desktop.png"),
    animations: "disabled",
  });
  await veto
    .getByRole("button", { name: "Reset preview", exact: true })
    .click();
  await veto.getByRole("button", { name: "BO1", exact: true }).click();
  await veto
    .getByRole("button", { name: "Auto-complete veto", exact: true })
    .click();
  await expect(
    veto
      .getByRole("list", { name: "Selected maps in play order" })
      .getByRole("listitem"),
  ).toHaveCount(1);
  await veto
    .getByRole("combobox", { name: "First team", exact: true })
    .selectOption("Orbit");
  await expect(
    veto.getByRole("combobox", { name: "Second team", exact: true }),
  ).toHaveValue("Atlas");
  await expect(
    veto.getByRole("list", { name: "Map veto history" }).getByRole("listitem"),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    veto.getByRole("button", { name: "BO3", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((request) => request === "GET /api/auth/me")).toBe(
    true,
  );
  expect(external).toEqual([]);
  const cta = page.getByRole("region", {
    name: "Find the right player for your roster",
    exact: true,
  });
  await cta.getByRole("link", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(
    page.getByRole("heading", { name: "Create account", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("main").getByRole("heading", {
      name: "Find players. Build teams. Compete.",
      exact: true,
    }),
  ).toBeVisible();
});

test("supports the full Guide on narrow screens with Polish and keyboard controls", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Guide", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Language & region", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Language", exact: true })
    .click();
  await page.getByRole("option", { name: "Polski", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Jak to działa", exact: true }),
  ).toBeVisible();
  const steps = page.locator(".guide-tutorial-steps button");
  await steps.nth(2).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".guide-mock-chat .guide-bubble")).toHaveCount(3);
  await page.locator("#guide-how").screenshot({
    path: info.outputPath("guide-how-mobile-pl.png"),
    animations: "disabled",
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const id of ["events", "recruitment", "bracket", "rankings", "veto"]) {
      await page.locator(`#guide-${id}`).scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    expect(
      await page
        .locator(".guide-rankings-table")
        .evaluate((element) => element.scrollWidth > element.clientWidth),
    ).toBe(true);
  }
  const events = page.locator("#guide-events");
  await events
    .getByRole("group")
    .getByRole("button", { name: /^Zapisy otwarte/ })
    .click();
  await expect(events.getByRole("article")).toHaveCount(2);
  await events
    .getByRole("article")
    .first()
    .getByRole("link", { name: "Zgłoszone drużyny", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Zobacz skład Atlas", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Atlas" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("#guide-bracket").screenshot({
    path: info.outputPath("guide-bracket-mobile-pl.png"),
    animations: "disabled",
  });
  const veto = page.locator("#guide-veto");
  await veto
    .getByRole("button", { name: "Odrzuć Mirage", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    veto
      .getByRole("list", { name: "Historia wyboru map" })
      .getByRole("listitem"),
  ).toHaveCount(1);
  await veto.screenshot({
    path: info.outputPath("guide-veto-mobile-pl.png"),
    animations: "disabled",
  });
  await expect(
    page.getByRole("heading", {
      name: "Znajdź odpowiedniego gracza do swojego składu",
      exact: true,
    }),
  ).toBeVisible();
});

test("animates only the How it works tutorial and cancels inactive preview timers", async ({
  page,
}) => {
  const start = new Date("2030-01-01T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 60000));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/guide");
  const tutorial = page.locator(".guide-tutorial");
  const buttons = page.locator(".guide-tutorial-steps button");
  await expect(tutorial).toHaveAttribute("data-playing", "true");
  const finishStep = async () => {
    const progress = tutorial.locator(".guide-step-progress i");
    await expect(tutorial).toHaveAttribute("data-playing", "true");
    await expect
      .poll(() =>
        progress.evaluate((element) => {
          const animation = element.getAnimations()[0];
          return (
            animation?.playState === "running" &&
            !animation.pending &&
            Number(animation.currentTime) > 0
          );
        }),
      )
      .toBe(true);
    await progress.evaluate((element) => element.getAnimations()[0].finish());
  };
  for (const index of [1, 2, 3, 0]) {
    await finishStep();
    await expect(buttons.nth(index)).toHaveAttribute("aria-pressed", "true");
  }
  await tutorial.hover();
  await page.clock.runFor(15000);
  await expect(buttons.first()).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(0, 0);
  await expect(tutorial).toHaveAttribute("data-playing", "true");
  await finishStep();
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  await buttons.first().focus();
  await page.keyboard.press("Enter");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(15000);
  await expect(buttons.first()).toHaveAttribute("aria-pressed", "true");
  expect(
    await page
      .locator(".guide-typing")
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await expect(
    page.getByRole("button", { name: "Reduced motion enabled", exact: true }),
  ).toBeDisabled();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const veto = page.locator("#guide-veto");
  await veto
    .getByRole("button", { name: "Auto-complete veto", exact: true })
    .click();
  await veto
    .getByRole("button", { name: "Reset preview", exact: true })
    .click();
  await page.clock.runFor(3000);
  await expect(veto.locator(".guide-veto-log li")).toHaveCount(0);
  await expect(buttons.first()).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Home", exact: true })
    .count()
    .then(async (count) => {
      if (count)
        await page
          .getByRole("banner")
          .getByRole("link", { name: "Home", exact: true })
          .click();
      else
        await page
          .locator(".sidebar")
          .getByRole("link", { name: "Home", exact: true })
          .click();
    });
  await page.clock.runFor(30000);
  await expect(
    page.getByRole("main").getByRole("heading", {
      name: "Find players. Build teams. Compete.",
      exact: true,
    }),
  ).toBeVisible();
});
