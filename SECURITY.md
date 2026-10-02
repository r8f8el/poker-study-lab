# Poker Study Lab — Política de Segurança & Conformidade Técnica

## 1. Princípios de Segurança e Anti-Cheat

O **Poker Study Lab** é uma ferramenta de estudo, análise e aprimoramento técnico desenhada exclusivamente para operar dentro do ambiente autorizado pelo próprio usuário. O sistema segue diretrizes técnicas invioláveis:

- **Nenhum clique automatizado**: O software não contém nem implementa rotinas para emitir eventos de clique do mouse (`mouse_event`, `SendInput`, etc.).
- **Nenhum movimento de mouse**: O cursor do sistema operacional permanece 100% sob controle humano.
- **Nenhum envio de teclado**: Não há injeção de teclas ou comandos para outros softwares.
- **Isolamento de janelas**: A captura é restrita única e exclusivamente à janela/região explicitamente autorizada pelo usuário (`appIdentifier` verificado). Qualquer janela não reconhecida bloqueia imediatamente a análise via `RecommendationGate`.
- **Nenhuma tentativa de ofuscação**: O software não se oculta do gerenciador de tarefas nem esconde suas janelas de captura.
- **Indicador visível obrigatório**: Um indicador permanente e visível exibe se a captura está **ATIVA** (verde pulsante), **PAUSADA** (amarelo) ou **DESLIGADA** (vermelho).
- **Mecanismo de Desligamento Imediato (Kill Switch)**: Um botão de parada de emergência encerra a captura instantaneamente, descarrega buffers e limpa referências da memória.
- **Processamento 100% local**: Nenhuma captura de tela ou frame é transmitido para a internet. Frames temporários são descartados da memória imediatamente após cada ciclo de validação.

---

## 2. Validação entre Processos (IPC & Network)

1. **Vínculo Restrito ao Localhost**: Todos os serviços locais (FastAPI, WebSockets ou IPC) vinculam-se unicamente ao endereço `127.0.0.1`.
2. **Tokens de Autenticação Efêmeros**: Mensagens IPC requerem tokens de autorização gerados localmente e validados via esquema estrito Zod.
3. **Prevenção de Injeção**: Textos obtidos por OCR ou parsing visual são sanitizados e validados antes de qualquer consumo interno ou envio a modelos de IA.
4. **Proteção contra Path Traversal**: Caminhos de perfis e logs são estritamente contidos dentro do diretório autorizado do aplicativo.

---

## 3. Gestão de Memória e Retenção

- Frames capturados **não são gravados em disco por padrão**.
- O buffer de visualização retém apenas o frame mais recente em formato não persistido para renderização de overlay.
- Ao clicar em "Desligar" ou "Pausar", todos os buffers voláteis são zerados imediatamente.
