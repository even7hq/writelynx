# WriteLynx

Motor de **validação** e **redação** de dados sensíveis, configurável por regras JSON. Pensado para logs, telemetria, payloads de API e ambientes OpenResty.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org/)

## Recursos

- Redação recursiva de objetos, arrays e strings (chaves sensíveis + padrões no conteúdo)
- Validadores declarativos: **mod11** (CPF/CNPJ), **luhn** (cartão)
- Templates de mascaramento (`$0`, `$1`, `$d`, fatias `[início:fim]`)
- Regras embutidas e extensão por JSON ou API em runtime
- Runtimes: **Node.js/TypeScript**, **Lua/OpenResty** e **CLI** para pipes e arquivos

## Instalação

```bash
yarn add writelynx
# ou
npm install writelynx
```

## Uso rápido

### CLI

```bash
# stdin
cat application.log | writelynx

# arquivo
writelynx --only pii,auth ./application.log

# validar CPF
writelynx --validate cpf '529.982.247-25'

# regras customizadas (repetível)
writelynx --rules ./rules/tenant.json ./application.log
```

Variável opcional: `WRITELYNX_RULES` aponta para um JSON extra (merge sobre o builtin).

### JavaScript

```typescript
import { WriteLynxEngine } from "writelynx";

const engine = WriteLynxEngine.createDefault();

engine.redactString("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...");
engine.redact({ password: "secret", email: "user@example.com" });

const result = engine.validate("cpf", "529.982.247-25");
// { valid: true, ruleId: "cpf", validatorId: "cpf_mod11" }
```

### Lua (OpenResty)

```lua
local writelynx = require("writelynx")

writelynx.redact_string(log_line)
writelynx.redact_object({ password = "x", name = "Ana" })
writelynx.validate("cpf", "529.982.247-25")
```

## Regras

O ruleset é um JSON com três blocos:

| Bloco | Função |
|-------|--------|
| `validators` | Especificações `mod11` / `luhn` reutilizáveis |
| `field.rules` | Redação por nome de campo (regex na chave) |
| `pattern.rules` | Padrões no texto, com `validator`, `replacement` e `uses` |

Regras com o mesmo `id` fazem **merge**: entradas custom substituem as builtin.

Exemplo de pattern rule:

```json
{
  "id": "cpf",
  "pattern": "(?<!\\d)\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}(?!\\d)",
  "validator": "cpf_mod11",
  "replacement": "***.$d[3:6].$d[6:9]-**",
  "uses": ["redaction", "validation"]
}
```

Builtin: pacote [`@writelynx/builtin-rules`](packages/builtin-rules).

## Monorepo

| Pacote | Descrição |
|--------|-----------|
| [`packages/builtin-rules`](packages/builtin-rules) | Regras e validadores embutidos |
| [`packages/js`](packages/js) | Engine TypeScript + binário `writelynx` |
| [`packages/lua`](packages/lua) | Engine Lua (OpenResty) |
| [`packages/docs`](packages/docs) | Site de documentação (Astro Starlight) |

## Desenvolvimento

```bash
git clone https://github.com/even7hq/writelynx.git
cd writelynx
yarn install
yarn build
yarn test
yarn docs:watch
```

| Script | Ação |
|--------|------|
| `yarn build` | Compila JS e gera `builtin_rules.lua` |
| `yarn test` | Vitest (JS) e Busted (Lua, requer `busted` instalado) |
| `yarn docs:watch` | Servidor de documentação local |

## Documentação

Guia completo no site gerado por `packages/docs`:

- Uso em JavaScript
- Uso em Lua
- CLI, schema de regras, validadores e templates

## Licença

[MIT](LICENSE) - Copyright Even7
