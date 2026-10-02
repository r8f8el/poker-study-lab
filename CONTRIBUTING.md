# Contribuindo para o Poker Study Lab

Agradecemos o interesse em contribuir para o **Poker Study Lab**!

## Diretrizes de Desenvolvimento

1. **Incrementos Verificáveis**: Cada funcionalidade deve pertencer ao incremento planejado e acompanhar testes automatizados.
2. **Desacoplamento Rigoroso**: A camada de visão computacional, o motor determinístico e o Recommendation Gate devem permanecer independentes.
3. **Segurança Inegociável**: Nenhuma PR que adicione recursos de automação de clique, injeção de teclas ou ocultação de janelas será aceita sob nenhuma circunstância.
4. **Testes Obrigatórios**:
   ```bash
   npm test
   ```
   Todos os testes devem passar com 100% de sucesso.
