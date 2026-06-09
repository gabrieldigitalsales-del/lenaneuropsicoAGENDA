# AGENDA LENA NEUROPSICÓLOGA

Projeto React/Vite pronto para Vercel e Supabase.

## O que foi ajustado nesta versão

- Layout premium mantendo o estilo do Base44 enviado nas imagens.
- Responsivo para celular e desktop.
- No celular, o menu fica embaixo, estilo aplicativo.
- No desktop, o menu fica na lateral esquerda.
- Cards, calendário, pacientes e ajustes repaginados.
- Login simples apenas com senha.
- Supabase pronto com tabelas isoladas `lena_neuro_2026_*`.

## Senha padrão

```txt
asd123
```

## Rodar no Termux

1. Coloque o ZIP em Downloads.
2. No Termux, rode:

```bash
termux-setup-storage
cd ~/storage/downloads
unzip agenda-lena-premium-responsiva-supabase.zip
cd agenda-lena-base44-clone
bash termux-start.sh
```

O script copia o projeto para a pasta interna do Termux para evitar erro de permissão/symlink do Android.

Depois abra:

```txt
http://localhost:5173
```

## Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Rode o arquivo:

```txt
supabase/schema.sql
```

4. Crie um arquivo `.env` usando `.env.example` como base:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLIC
VITE_APP_PASSWORD=asd123
```

## Vercel

Suba o projeto na Vercel e coloque as mesmas variáveis de ambiente.
