import { test, expect } from "../fixtures";

test("Notificações: limita a pilha global ao rodapé", async ({ page }) => {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Entrar", exact: true });
  const stack = page.getByRole("region", { name: "Notificações" });
  const notices = stack.getByText("Confira o CPF e a senha informados.", { exact: true });

  await submit.press("Enter");
  await expect(notices).toHaveCount(1);
  for (let attempt = 0; attempt < 5; attempt++) {
    await submit.press("Enter");
  }
  await expect(notices).toHaveCount(3);
  const first = await notices.first().boundingBox();
  const last = await notices.last().boundingBox();
  expect(first!.y).toBeGreaterThan(last!.y);

  await page.setViewportSize({ width: 375, height: 300 });
  await expect.poll(() => stack.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.top >= innerHeight * 0.6 && bounds.bottom >= innerHeight - 16;
  })).toBe(true);
});

test("Login: campos, teclado e validação sem autenticação", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "LOGIN", exact: true })).toBeVisible();
  const cpf = page.getByRole("textbox", { name: /^CPF/ });
  const password = page.getByLabel(/^Senha/);
  const submit = page.getByRole("button", { name: "Entrar", exact: true });
  await expect(cpf).toBeInViewport();
  await expect(password).toBeVisible();
  await expect(submit).toBeInViewport();
  await cpf.fill("00000000000");
  await expect(cpf).toHaveValue("000.000.000-00");
  await cpf.press("Tab");
  await expect(password).toBeFocused();
  await expect(password).toHaveCSS("outline-style", "solid");
  await expect(password).toHaveCSS("outline-width", "2px");
  await password.fill("senha-piloto");
  await password.press("Tab");
  const showPassword = page.getByRole("button", { name: "Mostrar senha", exact: true });
  await expect(showPassword).toBeFocused();
  await showPassword.press("Space");
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar senha", exact: true }).press("Space");
  await expect(password).toHaveAttribute("type", "password");
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  // Invalid CPF exercises the real Zod/RHF validation and must never call loginAction.
  await submit.press("Enter");
  await expect(cpf).toHaveAttribute("aria-invalid", "true");
  await expect(cpf).toHaveAccessibleDescription("O CPF é inválido");
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
