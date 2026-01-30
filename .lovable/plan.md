
# Plano: Leitor de Códigos de Barras para UNISTOCK

## Visão Geral

Criar um sistema de leitura de códigos de barras usando a câmera do celular/computador para localizar e registrar produtos no sistema UNISTOCK. Quando o usuário escaneia uma etiqueta gerada pela UNISTOCK (que contém o SKU no código de barras), o sistema identifica o produto e permite ações rápidas.

## Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| Scanner por câmera | Usa a câmera do dispositivo para ler códigos de barras |
| Busca automática | Localiza o produto pelo SKU ou EAN escaneado |
| Ações rápidas | Ver detalhes, ajustar estoque, reimprimir etiqueta |
| Histórico de scans | Registro dos últimos produtos escaneados |
| Modo mobile-first | Otimizado para uso em smartphones no depósito |

## Fluxo do Usuário

```text
┌──────────────────────┐
│  Usuário abre        │
│  /app/scanner        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Clica "Escanear"    │
│  ou abre automático  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Câmera ativa        │
│  (solicita permissão)│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Aponta para código  │
│  de barras           │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  Sistema detecta código (ex: SKU-001)    │
│           ↓                               │
│  Busca produto: SKU = "SKU-001"          │
│  OU EAN = código escaneado               │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  Produto encontrado?                      │
│  ✅ Sim → Mostra card com info + ações   │
│  ❌ Não → "Produto não encontrado"       │
│          + Opção de cadastrar novo       │
└──────────────────────────────────────────┘
```

## Arquitetura Técnica

### Biblioteca Escolhida: html5-qrcode

Motivos para escolher `html5-qrcode`:
- Suporta CODE128 e EAN-13 (os formatos usados nas etiquetas UNISTOCK)
- Funciona em dispositivos móveis e desktop
- Não precisa de backend para processar
- Boa documentação e comunidade ativa
- Leve (~50KB)

### Estrutura de Arquivos

```text
src/
├── pages/
│   └── Scanner.tsx                    # Nova página /app/scanner
├── components/
│   └── scanner/
│       ├── BarcodeScanner.tsx         # Componente do scanner com câmera
│       ├── ScanResult.tsx             # Card com resultado do scan
│       ├── ScanHistory.tsx            # Histórico de produtos escaneados
│       └── QuickActions.tsx           # Botões de ação rápida
```

### Navegação

Adicionar nova rota no sidebar:
- Ícone: `ScanLine` do lucide-react
- Label: "Scanner"
- Path: `/app/scanner`

## Implementação Detalhada

### 1. Instalar Dependência

```bash
npm install html5-qrcode
```

### 2. Componente BarcodeScanner.tsx

Responsabilidades:
- Inicializar câmera com permissão do usuário
- Detectar códigos de barras em tempo real
- Callback quando código é detectado
- Botão para alternar câmera (frontal/traseira)
- Limpar recursos ao desmontar

Interface:
```typescript
interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onError?: (error: string) => void;
  isActive: boolean;
}
```

### 3. Componente ScanResult.tsx

Após detectar um código, exibe:
- Imagem do produto (se houver)
- Nome e SKU
- Estoque atual
- Preço de venda
- Botões de ação:
  - "Ver Detalhes" → navega para /app/products/:id
  - "Ajustar Estoque" → abre modal de ajuste
  - "Reimprimir Etiqueta" → abre gerador com produto pré-selecionado

### 4. Página Scanner.tsx

Layout:
- Header com título "Scanner de Produtos"
- Área do scanner (ocupa maior parte da tela em mobile)
- Card de resultado (aparece após scan)
- Histórico de scans recentes (últimos 5)

Lógica de busca:
```typescript
// Primeiro tenta buscar por SKU
const { data: product } = await supabase
  .from('products')
  .select('*')
  .eq('user_id', user.id)
  .eq('sku', scannedCode)
  .single();

// Se não encontrar, tenta por EAN
if (!product) {
  const { data: productByEan } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)
    .eq('ean', scannedCode)
    .single();
}
```

### 5. Modal de Ajuste de Estoque

Permite ajuste rápido:
- Entrada (adicionar estoque)
- Saída (remover estoque)
- Motivo (opcional)

### 6. Histórico de Scans

Armazena no localStorage:
- Últimos 10 produtos escaneados
- Timestamp de cada scan
- Permite re-escanear clicando no item

## Interface Visual

### Mobile (Prioridade)

```text
┌─────────────────────────────┐
│  ← Scanner de Produtos      │
├─────────────────────────────┤
│                             │
│   ┌───────────────────┐     │
│   │                   │     │
│   │    [CÂMERA]       │     │
│   │                   │     │
│   │  ▢ Área de scan   │     │
│   │                   │     │
│   └───────────────────┘     │
│                             │
│   🔄 Alternar câmera        │
│                             │
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │ 📦 Produto X        │    │
│  │ SKU: SKU-001        │    │
│  │ Estoque: 15 un      │    │
│  │ R$ 49,90            │    │
│  │                     │    │
│  │ [Detalhes] [Estoque]│    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│  Histórico recente          │
│  • Produto Y - há 2min      │
│  • Produto Z - há 5min      │
└─────────────────────────────┘
```

## Casos de Uso

### Cenário 1: Conferência de estoque
1. Funcionário pega produto na prateleira
2. Escaneia etiqueta UNISTOCK
3. Confere se estoque físico bate com sistema
4. Se diferente, ajusta pelo botão "Ajustar Estoque"

### Cenário 2: Localizar produto
1. Cliente pede produto específico
2. Funcionário escaneia qualquer unidade
3. Vê onde está armazenado (se tiver essa info)
4. Confirma preço e disponibilidade

### Cenário 3: Reimprimir etiqueta danificada
1. Escaneia produto com etiqueta legível mas danificada
2. Clica "Reimprimir Etiqueta"
3. Sistema abre gerador com produto pré-selecionado

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `package.json` | Modificar | Adicionar html5-qrcode |
| `src/pages/Scanner.tsx` | Criar | Página principal do scanner |
| `src/components/scanner/BarcodeScanner.tsx` | Criar | Componente do scanner |
| `src/components/scanner/ScanResult.tsx` | Criar | Card de resultado |
| `src/components/scanner/ScanHistory.tsx` | Criar | Lista de histórico |
| `src/components/scanner/QuickStockAdjust.tsx` | Criar | Modal de ajuste rápido |
| `src/components/layout/AppSidebar.tsx` | Modificar | Adicionar link do scanner |
| `src/App.tsx` | Modificar | Adicionar rota /app/scanner |

## Compatibilidade

| Dispositivo | Suporte |
|-------------|---------|
| iPhone Safari | ✅ iOS 11+ |
| Android Chrome | ✅ Todas versões |
| Desktop Chrome | ✅ Com webcam |
| Desktop Firefox | ✅ Com webcam |

## Considerações de Segurança

- Requer HTTPS para acessar câmera (já garantido pelo Lovable)
- Usuário precisa conceder permissão de câmera
- Busca apenas produtos do próprio user_id

## Próximos Passos (Futuro)

1. Modo offline com cache local
2. Som/vibração ao detectar código
3. Scan em lote para inventário
4. Integração com leitor externo via Bluetooth
