import { test, expect } from '@playwright/test';

test.describe('Poker Study Lab — End-to-End Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('deve carregar a interface desktop com branding e componentes principais', async ({ page }) => {
    // Check main title
    await expect(page.locator('h1')).toContainText('POKER STUDY LAB');
    
    // Check action buttons in header
    await expect(page.locator('#btn-start-capture')).toBeVisible();
    await expect(page.locator('#btn-open-source-selector')).toBeVisible();
    await expect(page.locator('#btn-open-correction')).toBeVisible();
    await expect(page.locator('#btn-open-settings')).toBeVisible();

    // Check Assistant / Recommendation panel
    await expect(page.locator('text=PAINEL POKER STUDY LAB')).toBeVisible();
    await expect(page.locator('text=SUA DECISÃO RECOMENDADA')).toBeVisible();
  });

  test('deve alternar perfis de layout entre Suprema Poker, PokerStars e Desktop', async ({ page }) => {
    const btnPokerStars = page.locator('#btn-layout-pokerstars');
    const btnSuprema = page.locator('#btn-layout-suprema');
    const btnDesktop = page.locator('#btn-layout-desktop');

    await expect(btnPokerStars).toBeVisible();
    await expect(btnSuprema).toBeVisible();
    await expect(btnDesktop).toBeVisible();

    // Switch to PokerStars
    await btnPokerStars.click();
    await expect(btnPokerStars).toContainText('PokerStars');

    // Switch to Suprema Poker
    await btnSuprema.click();
    await expect(btnSuprema).toContainText('Suprema');

    // Test ROI Calibration mode toggle
    const btnCalibrate = page.locator('#btn-calibrate-roi');
    await btnCalibrate.click();
    await expect(page.locator('text=Calibrando ROIs...')).toBeVisible();
    await expect(page.locator('#roi-board')).toBeVisible();
    await btnCalibrate.click();
    await expect(page.locator('text=Calibrar ROIs')).toBeVisible();
  });

  test('deve abrir modal de calibração manual (F2) e permitir ajuste', async ({ page }) => {
    await page.locator('#btn-open-correction').click();
    
    // Verify modal is displayed
    await expect(page.locator('text=Correção Manual da Leitura Visual')).toBeVisible();
    await expect(page.locator('text=Hero Carta 1')).toBeVisible();

    // Close modal
    await page.locator('button:has-text("Cancelar")').click();
    await expect(page.locator('text=Correção Manual da Leitura Visual')).not.toBeVisible();
  });

  test('deve abrir configurações e exibir salvaguardas de IA e consentimento externo', async ({ page }) => {
    await page.locator('#btn-open-settings').click();
    
    // Verify settings modal is open
    await expect(page.locator('text=Configurações do Poker Study Lab')).toBeVisible();

    // Navigate to AI tab
    await page.locator('button:has-text("IA Explicadora")').click();
    await expect(page.locator('text=Ativar Explicações Didáticas de IA')).toBeVisible();

    // Select custom external API provider
    const aiProviderSelect = page.locator('#select-ai-provider');
    await aiProviderSelect.selectOption('custom_api');

    // Verify explicit privacy consent checkbox and strict zero-image guarantee banner appear
    await expect(page.locator('#chk-external-api-consent')).toBeVisible();
    await expect(page.locator('text=Consentimento de Envio Externo')).toBeVisible();
    await expect(page.locator('text=Nenhuma imagem bruta, captura de tela ou frame')).toBeVisible();

    // Close settings
    await page.locator('text=Cancelar').click();
    await expect(page.locator('text=Configurações do Poker Study Lab')).not.toBeVisible();
  });

  test('deve abrir seletor de janela com checklist de conformidade', async ({ page }) => {
    await page.locator('#btn-open-source-selector').click();

    // Check window selector modal
    await expect(page.locator('text=Selecionar Janela e Confirmar Permissão')).toBeVisible();
    await expect(page.locator('text=Confirmação de Permissão e Conformidade (Obrigatório)')).toBeVisible();

    // Confirm button should be disabled without checklist
    const confirmBtn = page.locator('#btn-confirm-source');
    await expect(confirmBtn).toBeDisabled();

    // Close modal
    await page.locator('button:has-text("Cancelar")').click();
  });
});
