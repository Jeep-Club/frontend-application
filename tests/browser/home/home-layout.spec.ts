import { test, expect } from "../fixtures";

test("Home: marca à esquerda, ações à direita e sem seção de créditos", async ({ page }) => {
  await page.goto("/");

  const logo = page.getByRole("link", { name: "logo" });
  const help = page.getByRole("button", { name: "Como funciona?" });
  const login = page.getByRole("button", { name: "Entrar" });
  await expect(logo).toBeVisible();
  await expect(help).toBeVisible();
  await expect(login).toBeVisible();
  await expect(page.getByRole("heading", { name: "Créditos", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /entre em contato/i })).toHaveCount(0);

  const [logoBox, helpBox, loginBox] = await Promise.all([logo.boundingBox(), help.boundingBox(), login.boundingBox()]);
  expect(logoBox).not.toBeNull();
  expect(helpBox).not.toBeNull();
  expect(loginBox).not.toBeNull();
  expect(logoBox!.x + logoBox!.width).toBeLessThan(helpBox!.x);
  expect(loginBox!.x).toBeGreaterThan(page.viewportSize()!.width / 2);
});

test("carrossel de experiências se move continuamente", async ({ page }) => {
  await page.goto("/");

  const carousel = page.getByRole("region", { name: "Nossas experiências" });
  await expect(carousel.getByRole("group")).toHaveCount(8);
  for (const name of ["Aventura na lama", "Juntos para a próxima trilha", "Diversão sem frescura", "Aventura que aproxima", "Caminhos da serra", "Amizade em cada parada", "Parceiros de verdade", "Trilha, chuva e superação"]) {
    await expect(carousel.getByRole("heading", { name })).toHaveCount(1);
  }
  await expect(carousel.getByRole("button")).toHaveCount(0);
  const offsets = await carousel.locator("#experiencias-slides > div").evaluate((track) => {
    const animation = track.getAnimations()[0];
    animation.pause();
    return [0, 2000, 4000].map((time) => {
      animation.currentTime = time;
      return new DOMMatrix(getComputedStyle(track).transform).m41;
    });
  });
  expect(offsets[1]).toBeLessThan(offsets[0]);
  expect(offsets[2]).toBeLessThan(offsets[1]);
  expect(offsets[0] - offsets[1]).toBeCloseTo(offsets[1] - offsets[2], 1);
});

test("carrossel respeita a preferência de movimento reduzido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const carousel = page.getByRole("region", { name: "Nossas experiências" });
  await expect(carousel.getByRole("group", { name: "1 de 8" })).toBeVisible();
  await expect(carousel.getByRole("group", { name: "8 de 8" })).toBeVisible();
  await expect(carousel.locator("#experiencias-slides > div")).toHaveCSS("animation-name", "none");
});

test("arrastar e usar as setas desloca o carrossel sem interromper a animação", async ({ page }) => {
  await page.goto("/");
  const viewport = page.locator("#experiencias-slides");
  const track = viewport.locator(":scope > div");
  await viewport.scrollIntoViewIfNeeded();
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  const before = await track.evaluate((element) => Number(element.getAnimations()[0].currentTime));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 100, y, { steps: 4 });
  const during = await track.evaluate((element) => ({ time: Number(element.getAnimations()[0].currentTime), state: element.getAnimations()[0].playState }));
  expect(during.state).toBe("running");
  expect(during.time).toBeGreaterThan(before + 500);
  await page.mouse.up();
  await expect.poll(() => track.evaluate((element) => Number(element.getAnimations()[0].currentTime))).toBeGreaterThan(during.time);

  await viewport.focus();
  const beforeKey = await track.evaluate((element) => Number(element.getAnimations()[0].currentTime));
  await page.keyboard.press("ArrowRight");
  const afterKey = await track.evaluate((element) => Number(element.getAnimations()[0].currentTime));
  expect(afterKey).toBeGreaterThan(beforeKey + 500);
});
