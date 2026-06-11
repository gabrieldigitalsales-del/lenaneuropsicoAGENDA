# AGENDA LENA NEUROPSICÓLOGA

Versão corrigida para Supabase.

## Correções desta versão

- Salvamento no Supabase revisado.
- Erros do Supabase aparecem na tela em vez de falhar escondido.
- Indicador mostrando se está conectado ao Supabase ou em modo local.
- Valor padrão sem preenchimento automático; aparece apenas placeholder `Ex: 500`.
- Campos numéricos aceitam de 0 ao infinito, sem limite máximo.
- `patient_id` vazio corrigido para `null`, evitando erro UUID no Supabase.
- Updates não enviam `created_at`, `updated_at` nem tentam alterar o `id`.
- Schema atualizado com `numeric` sem limite de tamanho.

## Variáveis obrigatórias na Vercel

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLIC
VITE_APP_PASSWORD=asd123
```

Se aparecer `Modo local`, as variáveis não foram configuradas corretamente na Vercel.

## Rodar no Termux

```bash
termux-setup-storage
cd ~/storage/downloads
unzip agenda-lena-supabase-save-fix.zip
cd agenda-lena-supabase-save-fix
bash termux-start.sh
```

## Supabase

Rode o arquivo:

```txt
supabase/schema.sql
```
