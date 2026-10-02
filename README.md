# Poker Study Lab ♠

> **Assistente Desktop Local de Análise e Estudo de Pôquer em Tempo Real**

O **Poker Study Lab** é uma ferramenta de estudo e pós-jogo desenhada para observar uma janela ou região autorizada da tela do seu próprio aplicativo de pôquer, reconhecer o estado visual da mesa através de visão computacional local, validar os dados por consistência temporal de múltiplos frames e fornecer, em um painel lateral separado, o estado do jogo e a próxima ação recomendada.

---

## 🛡️ Regras Técnicas de Segurança & Anti-Cheat

O produto foi concebido estritamente para estudo e treinamento, obedecendo às seguintes regras técnicas invariantes:

- ❌ **Não clica automaticamente**
- ❌ **Não move o mouse**
- ❌ **Não digita ações nem envia teclas**
- ❌ **Não controla outros aplicativos**
- ❌ **Não tenta esconder nem ofuscar a captura**
- ✅ **Exibe indicador visual permanente de captura ativa** (Verde pulsante = Ativa, Amarelo = Pausada, Vermelho = Inativa)
- ✅ **Botão de desligamento imediato (Kill Switch) e pausa instantânea**
- ✅ **Bloqueia a análise via `RecommendationGate` caso a janela não corresponda ao aplicativo autorizado**
- ✅ **Processamento estritamente local — nenhum frame é transmitido para servidores externos**

Para mais detalhes, consulte [SECURITY.md](./SECURITY.md).

---

## 📐 Arquitetura do Sistema

```
Meu aplicativo de pôquer (Janela Autorizada)
          ↓
Captura da janela/região autorizada (ScreenCaptureAdapter)
          ↓
Visão computacional local & Extração de ROIs
          ↓
Validação temporal por múltiplos frames (TemporalCardValidator)
          ↓
Máquina de estados da partida (TableStateMachine)
          ↓
Histórico imutável de eventos (EventStore)
          ↓
Motor determinístico de pôquer (PokerEngine)
          ↓
Recommendation Gate (Bloqueio estrito de baixa confiança e inconsistências)
          ↓
Painel de análise ao vivo (LiveSplitView)
```

---

## 🖥️ Layout da Interface Principal (Split View)

```
┌──────────────────────────────┬──────────────────────────────┐
│                              │                              │
│  Meu jogo de pôquer          │  Painel Poker Study Lab       │
│  em execução                 │  análise em tempo real       │
│                              │                              │
│  mesa, cartas e ações        │  estado, confiança, histórico │
│                              │  e próxima ação recomendada   │
└──────────────────────────────┴──────────────────────────────┘
```

- **Lado Esquerdo**: Feed ao vivo da mesa capturada, com overlays visuais das Regiões de Interesse (ROI: Hero Cards, Board, Pot, Action Buttons) e alternador de cenários controlados para testes e calibração.
- **Lado Direito**:
  1. **Estado da Mesa**: Street, Pote, Posição do Hero e Jogador Ativo.
  2. **Cartas e Board**: Cartas próprias do Hero e cartas comunitárias com badges de confiança individual.
  3. **Histórico da Mão**: Registro cronológico de ações confirmadas.
  4. **Decisão Recomendada**: Exibição da ação sugerida e frequências teóricas quando liberada pelo `RecommendationGate`. Caso contrário, exibição detalhada dos motivos do bloqueio.
  5. **Controles Rápidos**: Botões de Pausa/Retomada e Correção Manual de Leitura.

---

## 🚀 Como Executar

### Pré-requisitos
- **Node.js** v20+ e **npm**
- **Python** 3.11+ (gerenciado via `uv`)

### 1. Instalar dependências
```bash
git clone https://github.com/r8f8el/poker-study-lab.git
cd poker-study-lab
npm install
```

### 2. Executar em modo de desenvolvimento
```bash
npm run dev
```
Acesse a aplicação no navegador em `http://127.0.0.1:5173`.

### 3. Validação de Tipagem TypeScript Estrita
```bash
npm run typecheck
```

### 4. Executar os testes automatizados TypeScript
```bash
npm test
```

### 5. Executar os testes Python da visão
```bash
uv run --with pytest pytest tests/vision
```

### 6. Executar como Aplicativo Desktop Nativo (Electron)
```bash
npm run desktop
```

### 7. Executar os testes End-to-End (Playwright)
```bash
npm run test:e2e
```

### 8. Compilar para produção
```bash
npm run build
```

---

## 🧪 Estrutura de Testes Automatizados

O projeto conta com suíte de testes unitários rápidos e determinísticos com Vitest (TypeScript) e Pytest (Python), além de testes E2E com Playwright:
- `tests/e2e/poker_lab_ui.spec.ts`: Suíte de testes ponta a ponta (E2E) com Playwright validando a renderização da interface desktop, chaveamento dinâmico de layouts (Suprema, PokerStars, Desktop), calibração visual interativa de ROIs, salvaguarda com modal de consentimento de IA e checklist obrigatório de conformidade no seletor de janelas.
- `tests/unit/circular_frame_buffer.test.ts`: Testa buffer circular de frames, descarte FIFO de frames obsoletos, limites estritos de memória e medição de latência.
- `tests/unit/window_lifecycle_monitor.test.ts`: Testa detecção automática de janela minimizada, redimensionada além da tolerância, indisponível ou desautorizada com emissão de alertas.
- `tests/unit/recommendation_gate.test.ts`: Testa todos os caminhos do `RecommendationGate` (janela desautorizada, pausa, animações ativas, cartas duplicadas, contagem inválida de cartas, baixa confiança, vez de outro jogador).
- `tests/unit/screen_capture.test.ts`: Testa o ciclo de vida do adaptador de captura, emissão de frames, controle de FPS e rejeição de fontes desautorizadas.
- `tests/unit/state_machine.test.ts`: Testa as transições canônicas da mesa de pôquer (WAITING_FOR_APP → WAITING_FOR_TABLE → NEW_HAND → PREFLOP → FLOP → TURN → RIVER) e bloqueio de saltos ilegais.
- `tests/unit/card_detector.test.ts`: Testa o `CardDetector` e `RoiManager` em TypeScript para reconhecimento de estados visuais (`EMPTY`, `CARD_BACK`, `VISIBLE_CARD`, `UNKNOWN`) e cálculo de slots de cartas proporcionais à resolução.
- `tests/vision/test_card_classifier.py`: Suíte Pytest testando o classificador OpenCV/Numpy de Rank (todos os 13 templates) e Naipe com pontuação de confiança independente.
- `tests/unit/temporal_validator.test.ts`: Testa validação temporal deslizante (7 frames, min 5 consensos), histerese contra ruído de 1 frame, supressão por animação e cálculo de dispersão temporal.
- `tests/unit/event_store.test.ts`: Testa imutabilidade estrita do log de eventos, ordenação e preenchimento de sequência, reconstrução determinística do estado completo da mão (Preflop -> Flop -> Turn -> River -> Complete) e incorporação auditada de correções manuais.
- `tests/vision/test_sqlite_event_store.py`: Suíte Pytest testando o `SqliteEventStore` canônico em Python com esquema relacional SQLite, armazenamento append-only, índices compostos e reconstrução exata do estado.
- `tests/unit/decision_engine.test.ts`: Testa avaliação de mãos de 5 a 7 cartas (Royal Flush a High Card, desempates e Wheel A-2-3-4-5), cálculo de pot odds, simulação rápida Monte Carlo de equity (AA vs KK, AKs vs 27o) e geração de recomendação com frequências balanceadas somando 1.0.
- `tests/vision/test_poker_engine.py`: Suíte Pytest testando o motor canônico de poker em Python (`services/poker_engine/`) com avaliador de mãos, Monte Carlo de equity e motor determinístico de estratégias de referência.
- `tests/vision/test_recommendation_gate.py`: Suíte Pytest testando o `RecommendationGate` avançado em Python com regras de latência, stack negativo, all-in inconsistente e contagem de jogadores.
- `tests/unit/range_matrix.test.ts`: Testa matriz 13x13 canônica de mãos, expansão de combos com exclusão de cartas mortas, gerador percentual de range (Top X%), sensibilidade de equity contra perfis Nit vs Calling Station e inclusão de perfil nas explicações.
- `tests/vision/test_range_model.py`: Suíte Pytest testando a matriz de ranges e modelo de perfis de adversários em Python.
- `tests/unit/ai_explanation_service.test.ts`: Testa o `AIExplanationService` em TypeScript: garantia estrita de inviolabilidade da recomendação, salvaguarda com gate fechado, raciocínio de EV+ vs pot odds, fold disciplinado, adaptações a perfis de oponentes, cache em memória e fallback seguro offline.
- `tests/vision/test_ai_explainer.py`: Suíte Pytest testando o `AIExplainer` em Python: invariância de decisão determinística, bloqueio por salvaguarda do gate, heurísticas de textura de bordo (wet/dry), EV e cálculo de pot odds.

---

## 📅 Roadmap de Incrementos

- [x] **Incremento 1 — Base do Desktop**: Shell desktop, painel dividido (LiveSplitView), configurações com verificação de segurança, botão de pausa/kill switch, contratos tipados, schemas Zod, fixtures controladas e suíte de testes.
- [x] **Incremento 2 — Captura**: Seleção dinâmica de janela/região via API do sistema operacional com confirmação explícita de permissão (`WindowSelectorModal`), buffer circular de descarte de frames com controle de latência (`CircularFrameBuffer`), detector de janela minimizada/redimensionada (`WindowLifecycleMonitor`), e adapter Python canônico (`services/vision/capture_adapter/screen_capture.py`).
- [x] **Incremento 3 — Reconhecimento de Cartas**: Calibração interativa de ROIs (`RoiCalibrationPanel`), gerenciador de coordenadas e escala (`RoiManager`), pipeline de extração e classificação de Rank/Naipe (`CardClassifier` em Python e `CardDetector` em TypeScript), estados visuais explícitos (`EMPTY`, `CARD_BACK`, `VISIBLE_CARD`, `ANIMATION`, `UNKNOWN`), banco de fixtures rotuladas (`card_fixtures.ts`) e suíte com 54 testes automatizados.
- [x] **Incremento 4 — Validação Temporal**: Janela móvel de frames (7 frames, consenso de 5), histerese rigorosa contra ruídos ou flickers pontuais de 1 frame, suspensão imediata e descarte durante animações visuais, cálculo de dispersão/consistência temporal e integração na interface com badge em tempo real.
- [x] **Incremento 5 — Máquina de Estados & EventStore**: Persistência local em SQLite (`services/game_state/sqlite_event_store.py`) e memória profunda com imutabilidade (`EventStore.ts`), gerador de `hand_id`, motor de redução pura e reconstrução de estado (`HandStateEngine.ts`), painel visual de auditoria no desktop e suporte à reprodução determinística do histórico da mão.
- [x] **Incremento 6 — Motor de Decisão Determinístico**: Avaliador completo de 5 a 7 cartas (`HandEvaluator.ts`), calculadora rápida de Monte Carlo e Pot Odds (`EquityCalculator.ts`), gerador de estratégia de referência (`DeterministicDecisionEngine.ts`), integração dinâmica em tempo real no desktop com exibição visual de Equity e Pot Odds.
- [x] **Incremento 7 — Recommendation Gate Avançado**: Refinamento de checagens multi-campo de integridade (stack negativo, inconsistência de all-in com fichas, contagem mínima de jogadores ativos, validação da soma de apostas vs pote), proteção estrita contra latência de frames obsoletos (`LATENCY_EXCEEDED` > 2000ms) conectada ao `CircularFrameBuffer` em tempo real.
- [x] **Incremento 8 — Painel de Decisão Interativo**: Matriz interativa de ranges 13x13 (`RangeMatrixPanel.tsx`), seletor de perfis de vilões (Rock/Nit, TAG, LAG, Calling Station, Custom), slider de percentil de range em tempo real, expansor de combinações com exclusão de cartas mortas (`RangeModel.ts`) e cálculo de equity range-vs-hand dinâmico.
- [x] **Incremento 9 — IA Explicadora**: Serviço desacoplado de mentoria pedagógica e contextualização didática (`AIExplanationService.ts` e `services/explanation_ai/ai_explainer.py`), garantia absoluta de não-interferência na recomendação determinística, motor de heurísticas offline ultrarrápido (0ms), suporte a fallback gracioso sem chaves/rede, card visual sofisticado com métricas de latência e conceitos teóricos (`AIExplanationPanel.tsx`) e 118 testes automatizados passando.
- [x] **Incremento 10 — Robustez & Empacotamento Desktop**: Empacotamento desktop nativo via Electron com IPC isolado e enumeração de janelas do SO, modo HUD transparente e fixado, e suíte completa de testes end-to-end (E2E) com Playwright validando o fluxo de ponta a ponta.

